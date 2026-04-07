'use strict';

/**
 * HTTP client abstraction layer.
 *
 * Provides GET, POST, and JSONP methods with the same response contract as
 * Angular's $http service: { data, status, statusText }.
 *
 * GET/POST use the Fetch API. JSONP uses dynamic <script> tag injection
 * (the same mechanism Angular used internally) to preserve cross-origin
 * Solr support without requiring CORS headers.
 */

var _jsonpCounter = 0;

function makeAbortError() {
  if (typeof DOMException !== 'undefined') {
    try {
      return new DOMException('The operation was aborted.', 'AbortError');
    } catch (_e) {
      /* IE / very old engines */
    }
  }
  var err = new Error('The operation was aborted.');
  err.name = 'AbortError';
  return err;
}

/**
 * Create a fetch-based HTTP client with the same response contract as
 * Angular's $http service.
 *
 * Success: resolves to { data, status, statusText }
 * Failure (4xx/5xx): rejects with { data, status, statusText }
 * Network error: rejects with { data: null, status: 0, statusText: '' }
 *
 * @param {Object} [options]
 * @param {Function} [options.fetch] - Custom fetch function (for testing)
 * @param {Function} [options.jsonpRequest] - Custom JSONP implementation `(url, config) => Promise`.
 *   The same **`config`** the client receives on **`jsonp(url, config)`** is forwarded (including
 *   **`config.signal`** when set). The built-in script-tag JSONP honours **`signal`**; **custom
 *   implementations must handle abort themselves** (e.g. reject with `AbortError` when
 *   `config.signal.aborted` or on the `abort` event) if callers rely on cancellation.
 * @param {'omit'|'same-origin'|'include'} [options.credentials] - Default
 *   {@link https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials | Request.credentials}
 *   for GET/POST. Omitted properties keep the environment default (`same-origin` in browsers).
 *   Use `'include'` for credentialed cross-origin requests when the server sends the right CORS
 *   headers. JSONP uses script tag injection, not this option.
 * @param {AbortSignal} [options.signal] - Default {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal | AbortSignal}
 *   for GET/POST (merged with per-request `config.signal` when both are set — request wins).
 *   JSONP: `config.signal` on `jsonp()` aborts the promise and removes the script when possible;
 *   the in-flight HTTP response cannot be cancelled.
 */
export function createFetchClient(options) {
  // Support legacy signature: createFetchClient(fetchFn)
  if (typeof options === 'function') {
    options = { fetch: options };
  }
  options = options || {};

  var _fetch = options.fetch || globalThis.fetch;
  var _jsonpRequest = options.jsonpRequest || null;
  var _defaultCredentials = options.credentials;
  var _defaultSignal = options.signal;

  function request(method, url, data, config) {
    config = config || {};
    var headers = Object.assign({}, config.headers || {});
    var fetchOptions = {
      method: method,
      headers: headers,
    };

    var credentials =
      config.credentials !== undefined ? config.credentials : _defaultCredentials;
    if (credentials !== undefined) {
      fetchOptions.credentials = credentials;
    }

    var signal = config.signal !== undefined ? config.signal : _defaultSignal;
    if (signal !== undefined && signal !== null) {
      fetchOptions.signal = signal;
    }

    if (data !== undefined && data !== null && method !== 'GET') {
      fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
      // Angular-style default: JSON objects → application/json; strings unchanged.
      // Skip default Content-Type if caller set one (any casing).
      var hasContentType = Object.keys(headers).some(function (h) {
        return h.toLowerCase() === 'content-type';
      });
      if (!hasContentType) {
        headers['Content-Type'] = 'application/json;charset=utf-8';
      }
    }

    return _fetch(url, fetchOptions)
      .then(function (response) {
        return response.text().then(function (text) {
          var parsed = null;
          if (text) {
            try {
              parsed = JSON.parse(text);
            } catch (_e) {
              parsed = text;
            }
          }
          var result = {
            data: parsed,
            status: response.status,
            statusText: response.statusText,
          };
          if (!response.ok) {
            result._httpClientError = true;
            throw result;
          }
          return result;
        });
      })
      .catch(function (err) {
        // Already a response-shaped rejection from the !response.ok path above
        if (err && err._httpClientError) {
          delete err._httpClientError;
          throw err;
        }
        if (err && err.name === 'AbortError') {
          throw err;
        }
        // Network error (fetch itself rejected, or text() failed).
        // Preserve the original error via `cause` so consumers and devtools
        // can still see the underlying message/stack while the documented
        // { data, status, statusText } shape is unchanged.
        throw { data: null, status: 0, statusText: '', cause: err };
      });
  }

  /**
   * JSONP via dynamic <script> tag injection.
   *
   * Appends a callback parameter to the URL, injects a <script> tag, and
   * resolves the promise when the server invokes the callback with data.
   * Matches Angular's $http.jsonp() behavior and response shape.
   *
   * @param {string} url - Request URL (must be a string; Angular `$sce` wrappers are not supported).
   * @param {Object} [config]
   * @param {string} [config.jsonpCallbackParam] - Query parameter name for the callback (default `callback`).
   * @param {AbortSignal} [config.signal] - When aborted, rejects with `AbortError` and removes the script tag
   *   (default implementation only). With **`jsonpRequest`**, the override receives **`config.signal`** but
   *   must implement cancellation if needed — see **`options.jsonpRequest`** on {@link createFetchClient}.
   */
  function jsonp(url, config) {
    config = config || {};

    if (_jsonpRequest) {
      return _jsonpRequest(url, config);
    }

    var signal = config.signal;
    var signalUsable =
      signal &&
      typeof signal.addEventListener === 'function' &&
      typeof signal.removeEventListener === 'function';
    if (signal && signal.aborted) {
      return Promise.reject(makeAbortError());
    }

    var callbackParam = config.jsonpCallbackParam || 'callback';
    var callbackName = '__splainerJsonpCb_' + (_jsonpCounter++);
    var separator = url.indexOf('?') === -1 ? '?' : '&';
    var scriptUrl = url + separator + encodeURIComponent(callbackParam) + '=' + callbackName;

    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var settled = false;

      function cleanup() {
        delete globalThis[callbackName];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        if (signalUsable) {
          signal.removeEventListener('abort', onAbort);
        }
      }

      function onAbort() {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(makeAbortError());
      }

      if (signalUsable) {
        signal.addEventListener('abort', onAbort);
      }

      globalThis[callbackName] = function (data) {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve({
          data: data,
          status: 200,
          statusText: 'OK',
        });
      };

      script.onerror = function () {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject({ data: null, status: 0, statusText: '' });
      };

      script.src = scriptUrl;
      document.head.appendChild(script);
    });
  }

  return {
    get: function (url, config) {
      return request('GET', url, null, config);
    },
    post: function (url, data, config) {
      return request('POST', url, data, config);
    },
    jsonp: jsonp,
  };
}


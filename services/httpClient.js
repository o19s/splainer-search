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
 * @param {Function} [options.jsonpRequest] - Custom JSONP function (for testing)
 */
export function createFetchClient(options) {
  // Support legacy signature: createFetchClient(fetchFn)
  if (typeof options === 'function') {
    options = { fetch: options };
  }
  options = options || {};

  var _fetch = options.fetch || globalThis.fetch;
  var _jsonpRequest = options.jsonpRequest || null;

  function request(method, url, data, config) {
    var headers = (config && config.headers) || {};
    var fetchOptions = {
      method: method,
      headers: headers,
    };

    if (data !== undefined && data !== null && method !== 'GET') {
      fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
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
        // Network error (fetch itself rejected, or text() failed)
        throw { data: null, status: 0, statusText: '' };
      });
  }

  /**
   * JSONP via dynamic <script> tag injection.
   *
   * Appends a callback parameter to the URL, injects a <script> tag, and
   * resolves the promise when the server invokes the callback with data.
   * Matches Angular's $http.jsonp() behavior and response shape.
   */
  function jsonp(url, config) {
    if (_jsonpRequest) {
      return _jsonpRequest(url, config);
    }

    var callbackParam = (config && config.jsonpCallbackParam) || 'callback';
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
      }

      globalThis[callbackName] = function (data) {
        if (settled) { return; }
        settled = true;
        cleanup();
        resolve({
          data: data,
          status: 200,
          statusText: 'OK',
        });
      };

      script.onerror = function () {
        if (settled) { return; }
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

// Angular DI registration (removed in Phase 4)
// Currently returns $http so existing $httpBackend-based tests keep working.
// Swapped to createFetchClient() once all callers are migrated off $httpBackend.
if (typeof angular !== 'undefined') {
  angular
    .module('o19s.splainer-search')
    .factory('httpClient', [
      '$http',
      function ($http) {
        return $http;
      },
    ]);
}

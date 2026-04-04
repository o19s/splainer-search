'use strict';

/**
 * HTTP client abstraction layer.
 *
 * Phase 3 migration shim: in the Angular context this is registered as a
 * factory that returns $http directly, so all existing $httpBackend mocking
 * continues to work. Transport factories inject 'httpClient' instead of '$http'.
 *
 * A future step will swap the Angular registration to use a fetch-based
 * implementation (createFetchClient below) and update test mocking accordingly.
 */

/**
 * Create a fetch-based HTTP client with the same response contract as
 * Angular's $http service.
 *
 * Success: resolves to { data, status, statusText }
 * Failure (4xx/5xx): rejects with { data, status, statusText }
 * Network error: rejects with { data: null, status: 0, statusText: '' }
 *
 * Not yet wired into Angular DI — used by Vitest tests to validate the
 * contract before swapping.
 */
export function createFetchClient(fetchFn) {
  var _fetch = fetchFn || globalThis.fetch;

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

  return {
    get: function (url, config) {
      return request('GET', url, null, config);
    },
    post: function (url, data, config) {
      return request('POST', url, data, config);
    },
    jsonp: function (url, config) {
      // JSONP via fetch: treated as a plain GET. The json.wrf callback param
      // is only meaningful for Solr's JSONP endpoint; when migrating to fetch,
      // callers should switch to GET/POST instead of JSONP.
      return request('GET', url, null, config);
    },
  };
}

// Angular DI registration (removed in Phase 4)
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

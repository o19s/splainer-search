'use strict';

/**
 * MockHttpBackend — a test double for Angular's $httpBackend that works with
 * createFetchClient's { fetch, jsonpRequest } injection points.
 *
 * API mirrors $httpBackend where it matters:
 *   expectGET(urlMatcher [, headersMatcher])  → Expectation (.respond(status, data [, headers]))
 *   expectPOST(urlMatcher [, bodyMatcher [, headersMatcher]])  → Expectation
 *   expectJSONP(urlMatcher)                   → Expectation
 *   verifyNoOutstandingExpectation()
 *
 * Usage in a Karma spec:
 *   var mockBackend;
 *   beforeEach(module(function ($provide) {
 *     mockBackend = new MockHttpBackend();
 *     $provide.factory('httpClient', function () {
 *       return createFetchClient({
 *         fetch: mockBackend.fetch,
 *         jsonpRequest: mockBackend.jsonpRequest,
 *       });
 *     });
 *   }));
 *
 * URL matchers: string (exact), RegExp, or object with .test(url) method
 * (e.g. urlContainsParams helper).
 *
 * Body matchers (POST): function(body), object with .test(body), or plain
 * object/string for deep equality.
 */
window.MockHttpBackend = function MockHttpBackend() {
  var expectations = [];
  var self = this;

  // ── Expectation ──────────────────────────────────────────────────────
  function Expectation(method, urlMatcher, bodyMatcher, headersMatcher) {
    this.method = method;
    this.urlMatcher = urlMatcher;
    this.bodyMatcher = bodyMatcher;
    this.headersMatcher = headersMatcher;
    this.matched = false;
    this._status = 200;
    this._data = {};
    this._headers = {};
  }

  Expectation.prototype.respond = function (status, data, headers) {
    this._status = status;
    this._data = data;
    this._headers = headers || {};
    return this;
  };

  // ── Matching helpers ─────────────────────────────────────────────────
  function matchUrl(matcher, url) {
    if (typeof matcher === 'string') { return url === matcher; }
    if (matcher instanceof RegExp) { return matcher.test(url); }
    if (matcher && typeof matcher.test === 'function') { return matcher.test(url); }
    return false;
  }

  function matchBody(matcher, body) {
    if (matcher === undefined || matcher === null) { return true; }
    if (typeof matcher === 'function') { return matcher(body); }
    if (matcher && typeof matcher.test === 'function') { return matcher.test(body); }
    // Deep-equality check (object or string)
    var bodyForCompare = body;
    if (typeof bodyForCompare === 'string') {
      try { bodyForCompare = JSON.parse(bodyForCompare); } catch (_e) { /* keep as string */ }
    }
    return JSON.stringify(matcher) === JSON.stringify(bodyForCompare);
  }

  function matchHeaders(matcher, headers) {
    if (matcher === undefined || matcher === null) { return true; }
    if (typeof matcher === 'function') { return matcher(headers); }
    // Object: every key in matcher must match the corresponding header
    var keys = Object.keys(matcher);
    for (var i = 0; i < keys.length; i++) {
      if (!headers || headers[keys[i]] !== matcher[keys[i]]) { return false; }
    }
    return true;
  }

  function findExpectation(method, url, body, headers) {
    for (var i = 0; i < expectations.length; i++) {
      var exp = expectations[i];
      if (!exp.matched && exp.method === method &&
          matchUrl(exp.urlMatcher, url) &&
          matchBody(exp.bodyMatcher, body) &&
          matchHeaders(exp.headersMatcher, headers)) {
        exp.matched = true;
        return exp;
      }
    }
    return null;
  }

  // ── fetch function (for createFetchClient) ───────────────────────────
  self.fetch = function mockFetch(url, options) {
    var method = (options && options.method) || 'GET';
    var body = options && options.body;
    var headers = (options && options.headers) || {};
    var exp = findExpectation(method, url, body, headers);

    if (!exp) {
      return Promise.reject(
        new Error('Unexpected ' + method + ' request: ' + url)
      );
    }

    var isOk = exp._status >= 200 && exp._status < 300;
    var responseText =
      typeof exp._data === 'string' ? exp._data : JSON.stringify(exp._data);

    return Promise.resolve({
      ok: isOk,
      status: exp._status,
      statusText: isOk ? 'OK' : 'Error',
      text: function () {
        return Promise.resolve(responseText);
      },
    });
  };

  // ── jsonpRequest function (for createFetchClient) ────────────────────
  self.jsonpRequest = function mockJsonpRequest(url) {
    // Angular's $sce.trustAsResourceUrl wraps the URL in an object; unwrap it.
    if (url && typeof url !== 'string' && typeof url.toString === 'function') {
      url = url.toString();
    }
    var exp = findExpectation('JSONP', url, null);

    if (!exp) {
      return Promise.reject(
        new Error('Unexpected JSONP request: ' + url)
      );
    }

    var isOk = exp._status >= 200 && exp._status < 300;
    if (isOk) {
      return Promise.resolve({
        data: exp._data,
        status: exp._status,
        statusText: 'OK',
      });
    }
    return Promise.reject({
      data: exp._data,
      status: exp._status,
      statusText: 'Error',
    });
  };

  // ── Expectation registration (mirrors $httpBackend API) ──────────────
  self.expectGET = function (urlMatcher, headersMatcher) {
    var exp = new Expectation('GET', urlMatcher, null, headersMatcher);
    expectations.push(exp);
    return exp;
  };

  self.expectPOST = function (urlMatcher, bodyMatcher, headersMatcher) {
    var exp = new Expectation('POST', urlMatcher, bodyMatcher, headersMatcher);
    expectations.push(exp);
    return exp;
  };

  self.expectJSONP = function (urlMatcher) {
    var exp = new Expectation('JSONP', urlMatcher, null);
    expectations.push(exp);
    return exp;
  };

  // ── Verification ───���─────────────────────────────────────────────────
  self.verifyNoOutstandingExpectation = function () {
    var unmatched = [];
    for (var i = 0; i < expectations.length; i++) {
      if (!expectations[i].matched) {
        unmatched.push(
          expectations[i].method + ' ' + expectations[i].urlMatcher
        );
      }
    }
    if (unmatched.length > 0) {
      throw new Error(
        'Unsatisfied request expectations:\n  ' + unmatched.join('\n  ')
      );
    }
  };

  self.resetExpectations = function () {
    expectations = [];
  };
};

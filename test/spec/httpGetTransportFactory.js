'use strict';

/**
 * Unit tests for HttpGetTransportFactory using fetch-based httpClient.
 * Pins the contract: query(url, payload, headers) issues a GET with headers,
 * ignores payload, and returns a promise with { data, status, statusText }.
 */
/*global createFetchClient*/
describe('Factory: HttpGetTransportFactory (fetch)', function () {
  beforeEach(module('o19s.splainer-search'));

  var HttpGetTransportFactory;
  var fetchSpy;

  // Override httpClient to use createFetchClient with a mock fetch
  beforeEach(module(function ($provide) {
    fetchSpy = jasmine.createSpy('fetch');
    $provide.factory('httpClient', function () {
      return createFetchClient({ fetch: fetchSpy });
    });
  }));

  beforeEach(inject(function (_HttpGetTransportFactory_) {
    HttpGetTransportFactory = _HttpGetTransportFactory_;
  }));

  function respondWith(status, body) {
    var bodyText = typeof body === 'string' ? body : JSON.stringify(body);
    var isOk = status >= 200 && status < 300;
    fetchSpy.and.returnValue(
      Promise.resolve({
        ok: isOk,
        status: status,
        statusText: isOk ? 'OK' : 'Error',
        text: function () { return Promise.resolve(bodyText); },
      })
    );
  }

  it('issues a GET request to the given URL', function (done) {
    respondWith(200, { ok: true });
    var transport = new HttpGetTransportFactory();
    transport.query('http://example.com/search?q=test', {}, {}).then(function () {
      expect(fetchSpy).toHaveBeenCalled();
      var callArgs = fetchSpy.calls.mostRecent().args;
      expect(callArgs[0]).toBe('http://example.com/search?q=test');
      expect(callArgs[1].method).toBe('GET');
      done();
    }).catch(done.fail);
  });

  it('passes custom headers through', function (done) {
    respondWith(200, {});
    var transport = new HttpGetTransportFactory();
    var headers = { 'X-Custom': 'value', 'Authorization': 'Bearer tok' };
    transport.query('http://example.com/search', {}, headers).then(function () {
      var callArgs = fetchSpy.calls.mostRecent().args;
      expect(callArgs[1].headers).toEqual(headers);
      done();
    }).catch(done.fail);
  });

  it('ignores the payload argument (GET has no body)', function (done) {
    respondWith(200, { result: 'ok' });
    var transport = new HttpGetTransportFactory();
    transport.query('http://example.com/search', { should: 'be ignored' }, {}).then(function () {
      var callArgs = fetchSpy.calls.mostRecent().args;
      expect(callArgs[1].body).toBeUndefined();
      done();
    }).catch(done.fail);
  });

  it('returns a promise that resolves with the response', function (done) {
    respondWith(200, { found: 1 });
    var transport = new HttpGetTransportFactory();
    transport.query('http://example.com/search', {}, {}).then(function (response) {
      expect(response.data).toEqual({ found: 1 });
      expect(response.status).toBe(200);
      done();
    }).catch(done.fail);
  });

  it('returns a promise that rejects on HTTP error', function (done) {
    respondWith(500, { error: 'fail' });
    var transport = new HttpGetTransportFactory();
    transport.query('http://example.com/search', {}, {}).then(
      function () { done.fail('should have rejected'); },
      function (response) {
        expect(response.status).toBe(500);
        expect(response.data).toEqual({ error: 'fail' });
        done();
      }
    );
  });

  it('stores options passed to constructor', function () {
    var opts = { apiMethod: 'GET', custom: true };
    var transport = new HttpGetTransportFactory(opts);
    expect(transport.options()).toEqual(opts);
  });

  it('inherits from TransportFactory (has options method)', function () {
    var transport = new HttpGetTransportFactory({ test: 1 });
    expect(typeof transport.options).toBe('function');
    expect(transport.options()).toEqual({ test: 1 });
  });
});

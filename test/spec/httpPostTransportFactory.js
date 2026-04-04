'use strict';

/**
 * Unit tests for HttpPostTransportFactory using fetch-based httpClient.
 * Pins the contract: query(url, payload, headers) issues a POST with body+headers,
 * and returns a promise with { data, status, statusText }.
 */
/*global createFetchClient*/
describe('Factory: HttpPostTransportFactory (fetch)', function () {
  beforeEach(module('o19s.splainer-search'));

  var HttpPostTransportFactory;
  var fetchSpy;

  // Override httpClient to use createFetchClient with a mock fetch
  beforeEach(module(function ($provide) {
    fetchSpy = jasmine.createSpy('fetch');
    $provide.factory('httpClient', function () {
      return createFetchClient({ fetch: fetchSpy });
    });
  }));

  beforeEach(inject(function (_HttpPostTransportFactory_) {
    HttpPostTransportFactory = _HttpPostTransportFactory_;
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

  it('issues a POST request to the given URL', function (done) {
    respondWith(200, { ok: true });
    var transport = new HttpPostTransportFactory();
    transport.query('http://example.com/search', { query: { match_all: {} } }, {}).then(function () {
      var callArgs = fetchSpy.calls.mostRecent().args;
      expect(callArgs[0]).toBe('http://example.com/search');
      expect(callArgs[1].method).toBe('POST');
      done();
    }).catch(done.fail);
  });

  it('sends the payload as the POST body', function (done) {
    respondWith(200, {});
    var transport = new HttpPostTransportFactory();
    var payload = { query: { match: { title: 'test' } }, size: 10 };
    transport.query('http://example.com/search', payload, {}).then(function () {
      var callArgs = fetchSpy.calls.mostRecent().args;
      expect(callArgs[1].body).toBe(JSON.stringify(payload));
      done();
    }).catch(done.fail);
  });

  it('passes custom headers through', function (done) {
    respondWith(200, {});
    var transport = new HttpPostTransportFactory();
    var headers = { 'X-Api-Key': 'secret', 'Content-Type': 'application/json' };
    transport.query('http://example.com/search', {}, headers).then(function () {
      var callArgs = fetchSpy.calls.mostRecent().args;
      expect(callArgs[1].headers).toEqual(headers);
      done();
    }).catch(done.fail);
  });

  it('returns a promise that resolves with the response', function (done) {
    respondWith(200, { hits: [] });
    var transport = new HttpPostTransportFactory();
    transport.query('http://example.com/search', { q: 'test' }, {}).then(function (response) {
      expect(response.data).toEqual({ hits: [] });
      expect(response.status).toBe(200);
      done();
    }).catch(done.fail);
  });

  it('returns a promise that rejects on HTTP error', function (done) {
    respondWith(403, { error: 'forbidden' });
    var transport = new HttpPostTransportFactory();
    transport.query('http://example.com/search', {}, {}).then(
      function () { done.fail('should have rejected'); },
      function (response) {
        expect(response.status).toBe(403);
        expect(response.data).toEqual({ error: 'forbidden' });
        done();
      }
    );
  });

  it('stores options passed to constructor', function () {
    var opts = { apiMethod: 'POST', timeout: 5000 };
    var transport = new HttpPostTransportFactory(opts);
    expect(transport.options()).toEqual(opts);
  });

  it('inherits from TransportFactory (has options method)', function () {
    var transport = new HttpPostTransportFactory({});
    expect(typeof transport.options).toBe('function');
  });
});

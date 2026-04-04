'use strict';

/**
 * Tests for HttpJsonpTransportFactory using fetch-based httpClient.
 * Validates JSONP requests and the Basic-auth-in-URL workaround.
 */
/*global createFetchClient*/
describe('Factory: HttpJsonpTransportFactory (fetch)', function () {
  beforeEach(module('o19s.splainer-search'));

  var HttpJsonpTransportFactory;
  var jsonpSpy;

  // Override httpClient to createFetchClient with a mock jsonpRequest,
  // and provide a passthrough $sce since the factory still conditionally uses it.
  beforeEach(module(function ($provide) {
    jsonpSpy = jasmine.createSpy('jsonpRequest').and.returnValue(
      Promise.resolve({ data: { ok: true }, status: 200, statusText: 'OK' })
    );
    $provide.factory('httpClient', function () {
      return createFetchClient({
        fetch: function () { throw new Error('fetch should not be called for JSONP'); },
        jsonpRequest: jsonpSpy,
      });
    });
    // Passthrough $sce — in the fetch path, $sce.trustAsResourceUrl is a no-op
    $provide.value('$sce', {
      trustAsResourceUrl: function (url) { return url; },
    });
  }));

  beforeEach(inject(function (_HttpJsonpTransportFactory_) {
    HttpJsonpTransportFactory = _HttpJsonpTransportFactory_;
  }));

  it('issues a JSONP request without rewriting the URL when no Authorization header is set', function (done) {
    var transport = new HttpJsonpTransportFactory();
    var url = 'https://search.example.com/api?q=test';
    transport.query(url, {}, {}).then(function () {
      var callArgs = jsonpSpy.calls.mostRecent().args;
      expect(callArgs[0]).toBe(url);
      expect(callArgs[1]).toEqual({ jsonpCallbackParam: 'json.wrf' });
      done();
    }).catch(done.fail);
  });

  it('embeds decoded Basic credentials in the URL because JSONP cannot send headers', function (done) {
    var transport = new HttpJsonpTransportFactory();
    var url = 'https://search.example.com/solr/select';
    var headers = { Authorization: 'Basic ' + btoa('admin:secret/w') };
    transport.query(url, {}, headers).then(function () {
      var calledUrl = jsonpSpy.calls.mostRecent().args[0];
      var expectedPrefix = 'https://admin:' + encodeURIComponent('secret/w') + '@search.example.com/solr/select';
      expect(calledUrl).toBe(expectedPrefix);
      done();
    }).catch(done.fail);
  });

  it('does not modify the URL when Authorization header is not Basic auth', function (done) {
    var transport = new HttpJsonpTransportFactory();
    var url = 'https://search.example.com/solr/select';
    // No Authorization header at all
    transport.query(url, {}, { 'X-Other': 'value' }).then(function () {
      var calledUrl = jsonpSpy.calls.mostRecent().args[0];
      expect(calledUrl).toBe(url);
      done();
    }).catch(done.fail);
  });

  it('passes the jsonpCallbackParam config to httpClient.jsonp', function (done) {
    var transport = new HttpJsonpTransportFactory();
    transport.query('https://example.com/solr/select', {}, {}).then(function () {
      var config = jsonpSpy.calls.mostRecent().args[1];
      expect(config.jsonpCallbackParam).toBe('json.wrf');
      done();
    }).catch(done.fail);
  });
});

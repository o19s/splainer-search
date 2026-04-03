'use strict';

/**
 * Direct unit tests for HttpGetTransportFactory.
 * Pins the contract: query(url, payload, headers) issues $http.get with headers,
 * ignores payload, and returns the $http promise.
 */
/*global describe,beforeEach,module,inject,it,expect*/
describe('Factory: HttpGetTransportFactory', function() {
  beforeEach(module('o19s.splainer-search'));

  var $httpBackend;
  var $timeout;
  var HttpGetTransportFactory;

  beforeEach(inject(function($injector, _HttpGetTransportFactory_) {
    $httpBackend = $injector.get('$httpBackend');
    $timeout = $injector.get('$timeout');
    HttpGetTransportFactory = _HttpGetTransportFactory_;
  }));

  it('issues a GET request to the given URL', function() {
    var transport = new HttpGetTransportFactory();
    var url = 'http://example.com/search?q=test';
    transport.query(url, {}, {});
    $httpBackend.expectGET(url).respond(200, { ok: true });
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('passes custom headers through to $http.get', function() {
    var transport = new HttpGetTransportFactory();
    var url = 'http://example.com/search';
    var headers = { 'X-Custom': 'value', 'Authorization': 'Bearer tok' };
    transport.query(url, {}, headers);
    $httpBackend.expectGET(url, function(sentHeaders) {
      return sentHeaders['X-Custom'] === 'value' &&
             sentHeaders['Authorization'] === 'Bearer tok';
    }).respond(200, {});
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('ignores the payload argument (GET has no body)', function() {
    var transport = new HttpGetTransportFactory();
    var url = 'http://example.com/search';
    transport.query(url, { should: 'be ignored' }, {});
    // expectGET verifies no body was sent
    $httpBackend.expectGET(url).respond(200, { result: 'ok' });
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('returns a promise that resolves with the response', function() {
    var transport = new HttpGetTransportFactory();
    var url = 'http://example.com/search';
    var resolved = false;
    transport.query(url, {}, {}).then(function(response) {
      expect(response.data).toEqual({ found: 1 });
      resolved = true;
    });
    $httpBackend.expectGET(url).respond(200, { found: 1 });
    $timeout.flush();
    $httpBackend.flush();
    expect(resolved).toBe(true);
  });

  it('returns a promise that rejects on HTTP error', function() {
    var transport = new HttpGetTransportFactory();
    var url = 'http://example.com/search';
    var rejected = false;
    transport.query(url, {}, {}).then(function() {
      rejected = false;
    }, function(response) {
      expect(response.status).toBe(500);
      rejected = true;
    });
    $httpBackend.expectGET(url).respond(500, { error: 'fail' });
    $timeout.flush();
    $httpBackend.flush();
    expect(rejected).toBe(true);
  });

  it('stores options passed to constructor', function() {
    var opts = { apiMethod: 'GET', custom: true };
    var transport = new HttpGetTransportFactory(opts);
    expect(transport.options()).toEqual(opts);
  });

  it('inherits from TransportFactory (has options method)', function() {
    var transport = new HttpGetTransportFactory({ test: 1 });
    expect(typeof transport.options).toBe('function');
    expect(transport.options()).toEqual({ test: 1 });
  });
});

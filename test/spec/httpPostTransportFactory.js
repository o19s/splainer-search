'use strict';

/**
 * Direct unit tests for HttpPostTransportFactory.
 * Pins the contract: query(url, payload, headers) issues $http.post with body+headers,
 * and returns the $http promise.
 */
/*global describe,beforeEach,module,inject,it,expect*/
describe('Factory: HttpPostTransportFactory', function() {
  beforeEach(module('o19s.splainer-search'));

  var $httpBackend;
  var $timeout;
  var HttpPostTransportFactory;

  beforeEach(inject(function($injector, _HttpPostTransportFactory_) {
    $httpBackend = $injector.get('$httpBackend');
    $timeout = $injector.get('$timeout');
    HttpPostTransportFactory = _HttpPostTransportFactory_;
  }));

  it('issues a POST request to the given URL', function() {
    var transport = new HttpPostTransportFactory();
    var url = 'http://example.com/search';
    transport.query(url, { query: { match_all: {} } }, {});
    $httpBackend.expectPOST(url).respond(200, { ok: true });
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('sends the payload as the POST body', function() {
    var transport = new HttpPostTransportFactory();
    var url = 'http://example.com/search';
    var payload = { query: { match: { title: 'test' } }, size: 10 };
    transport.query(url, payload, {});
    $httpBackend.expectPOST(url, payload).respond(200, {});
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('passes custom headers through to $http.post', function() {
    var transport = new HttpPostTransportFactory();
    var url = 'http://example.com/search';
    var headers = { 'X-Api-Key': 'secret', 'Content-Type': 'application/json' };
    transport.query(url, {}, headers);
    $httpBackend.expectPOST(url, {}, function(sentHeaders) {
      return sentHeaders['X-Api-Key'] === 'secret';
    }).respond(200, {});
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('returns a promise that resolves with the response', function() {
    var transport = new HttpPostTransportFactory();
    var url = 'http://example.com/search';
    var resolved = false;
    transport.query(url, { q: 'test' }, {}).then(function(response) {
      expect(response.data).toEqual({ hits: [] });
      resolved = true;
    });
    $httpBackend.expectPOST(url).respond(200, { hits: [] });
    $timeout.flush();
    $httpBackend.flush();
    expect(resolved).toBe(true);
  });

  it('returns a promise that rejects on HTTP error', function() {
    var transport = new HttpPostTransportFactory();
    var url = 'http://example.com/search';
    var rejected = false;
    transport.query(url, {}, {}).then(function() {
      rejected = false;
    }, function(response) {
      expect(response.status).toBe(403);
      rejected = true;
    });
    $httpBackend.expectPOST(url).respond(403, { error: 'forbidden' });
    $timeout.flush();
    $httpBackend.flush();
    expect(rejected).toBe(true);
  });

  it('stores options passed to constructor', function() {
    var opts = { apiMethod: 'POST', timeout: 5000 };
    var transport = new HttpPostTransportFactory(opts);
    expect(transport.options()).toEqual(opts);
  });

  it('inherits from TransportFactory (has options method)', function() {
    var transport = new HttpPostTransportFactory({});
    expect(typeof transport.options).toBe('function');
  });
});

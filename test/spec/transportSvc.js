'use strict';

/**
 * Tests for transportSvc.getTransport: maps apiMethod and optional proxy wrapping.
 */
/*global describe,beforeEach,module,inject,it,expect*/
describe('Service: transportSvc', function() {
  beforeEach(module('o19s.splainer-search'));

  var $httpBackend;
  var $timeout;
  var transportSvc;

  beforeEach(inject(function($injector, _transportSvc_) {
    $httpBackend = $injector.get('$httpBackend');
    $timeout = $injector.get('$timeout');
    transportSvc = _transportSvc_;
  }));

  var mockResults = { hits: { total: 0, hits: [] } };

  it('selects POST transport by default', function() {
    var url = 'http://es.example.com/i/_search';
    var transport = transportSvc.getTransport({});
    transport.query(url, { query: { match_all: {} } }, {});
    $httpBackend.expectPOST(url).respond(200, mockResults);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('selects POST transport for explicit POST (any case)', function() {
    var url = 'http://es.example.com/i/_search';
    var transport = transportSvc.getTransport({ apiMethod: 'post' });
    transport.query(url, { query: { match_all: {} } }, {});
    $httpBackend.expectPOST(url).respond(200, mockResults);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('selects GET transport when apiMethod is GET (case-insensitive)', function() {
    var url = 'http://es.example.com/i/_search';
    var transport = transportSvc.getTransport({ apiMethod: 'get' });
    transport.query(url, { x: 1 }, { Accept: 'application/json' });
    $httpBackend.expectGET(url).respond(200, mockResults);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('selects JSONP transport when apiMethod is JSONP', function() {
    var url = 'http://solr.example.com/select?q=*:*';
    var transport = transportSvc.getTransport({ apiMethod: 'jsonp' });
    transport.query(url, {}, {});
    $httpBackend.expectJSONP(/^http:\/\/solr\.example\.com\/select\?q=\*:\*/).respond(200, mockResults);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('routes BULK apiMethod through the bulk transport (batched POST to _msearch)', function() {
    var url = 'http://es.example.com/_msearch';
    var transport = transportSvc.getTransport({ apiMethod: 'BULK' });
    var payload = { query: { match_all: {} } };
    transport.query(url, payload, { 'Content-Type': 'application/x-ndjson' });
    $httpBackend.expectPOST(url, function(body) {
      var lines = body.replace(/\n$/, '').split('\n');
      return lines.length === 2 &&
        angular.equals(JSON.parse(lines[0]), {}) &&
        angular.equals(JSON.parse(lines[1]), payload);
    }).respond(200, { responses: [mockResults] });
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });
});

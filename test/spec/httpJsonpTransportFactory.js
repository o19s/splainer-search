'use strict';

/**
 * Tests for HttpJsonpTransportFactory: JSONP requests and Basic-auth-in-URL workaround.
 */
/*global describe,beforeEach,module,inject,it,expect*/
describe('Factory: HttpJsonpTransportFactory', function() {
  beforeEach(module('o19s.splainer-search'));

  var $httpBackend;
  var $timeout;
  var HttpJsonpTransportFactory;

  var $sce;

  beforeEach(inject(function($injector, _HttpJsonpTransportFactory_) {
    $httpBackend = $injector.get('$httpBackend');
    $timeout = $injector.get('$timeout');
    $sce = $injector.get('$sce');
    HttpJsonpTransportFactory = _HttpJsonpTransportFactory_;
  }));

  it('issues a JSONP GET without rewriting the URL when no Authorization header is set', function() {
    var transport = new HttpJsonpTransportFactory();
    var url = 'https://search.example.com/api?q=test';
    transport.query(url, {}, {});
    $httpBackend.expectJSONP(function(u) {
      return u.indexOf('https://search.example.com/api?q=test') === 0;
    }).respond(200, { ok: true });
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('embeds decoded Basic credentials in the URL because JSONP cannot send headers', function() {
    var transport = new HttpJsonpTransportFactory();
    var url = 'https://search.example.com/solr/select';
    var headers = { Authorization: 'Basic ' + btoa('admin:secret/w') };
    transport.query(url, {}, headers);
    var expectedPrefix = 'https://admin:' + encodeURIComponent('secret/w') + '@search.example.com/solr/select';
    $httpBackend.expectJSONP(function(u) {
      return u.indexOf(expectedPrefix) === 0;
    }).respond(200, {});
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('invokes $sce.trustAsResourceUrl on the final URL before issuing JSONP', function() {
    spyOn($sce, 'trustAsResourceUrl').and.callThrough();
    var transport = new HttpJsonpTransportFactory();
    var url = 'https://search.example.com/solr/select?q=1';
    transport.query(url, {}, {});
    $httpBackend.expectJSONP(function() { return true; }).respond(200, {});
    $timeout.flush();
    $httpBackend.flush();
    expect($sce.trustAsResourceUrl).toHaveBeenCalled();
    expect($sce.trustAsResourceUrl.calls.mostRecent().args[0]).toContain('search.example.com');
  });
});

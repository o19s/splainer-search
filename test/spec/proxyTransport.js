'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Service: transport', function() {
  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  var $httpBackend;
  var $timeout;
  var HttpGetTransportFactory;
  
  // instantiate service
  var transportSvc;

  beforeEach(inject(function (_HttpGetTransportFactory_) {
    HttpGetTransportFactory = _HttpGetTransportFactory_;
  }));

  beforeEach(inject(function($injector) {
    $httpBackend = $injector.get('$httpBackend');
    $timeout = $injector.get('$timeout');
  }));
  
  beforeEach(inject(function (_transportSvc_) {
    transportSvc     = _transportSvc_;

  }));

  
  

  var mockResultsTemplate = {
    hits: {
      total: 2,
      'max_score': 1.0,
      hits: [
        {
        }
      ]
    }
  };


  it('ignores when a payload provided', function () {
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = {'header': 1};
    var headersToReceive = {
      "header":1,
      "Accept":"application/json, text/plain, */*"
    }
    var getTransport = new HttpGetTransportFactory();
    var payloadTemplate = {'test': 0};
    var payload = angular.copy(payloadTemplate);
    getTransport.query(url, payload, headers);
    $httpBackend.expectGET(url,headersToReceive).respond(200, mockResultsTemplate);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });
  
  it('can take options', function () {
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = {'header': 1};
    var options = {option1: true, "option2":"hello"};
    var getTransport = new HttpGetTransportFactory(options);
    var payloadTemplate = {'test': 0};
    var payload = angular.copy(payloadTemplate);
    getTransport.query(url, payload, headers);
    expect(getTransport.options()).toEqual(options);
    $httpBackend.expectGET(url).respond(200, mockResultsTemplate);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });  
  
  it('A POST can be wrapped in a proxy', function () {
    var url = 'http://es.splainer-search.com/foods/tacos/_search';
    var options = {
      apiMethod: 'POST',
      proxyUrl: 'http://localhost/proxy?url='
    };
    var transport = transportSvc.getTransport(options);
    
    var headers = {'header': 1};
    
    var payloadTemplate = {'test': 0};
    var payload = angular.copy(payloadTemplate);
    transport.query(url, payload, headers);
    $httpBackend.expectPOST('http://localhost/proxy?url=' + url).respond(200, mockResultsTemplate);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });
  
  it('A GET can be wrapped in a proxy', function () {
    var url = 'http://es.splainer-search.com/foods/tacos/_search';
    var options = {
      apiMethod: 'GET',
      proxyUrl: 'http://localhost/proxy/'
    };
    var transport = transportSvc.getTransport(options);
    
    var headers = {'header': 1};
    
    var payloadTemplate = {'test': 0};
    var payload = angular.copy(payloadTemplate);
    transport.query(url, payload, headers);
    $httpBackend.expectGET('http://localhost/proxy/' + url).respond(200, mockResultsTemplate);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });  


});

'use strict';

/*global describe,beforeEach,inject,it,expect,createFetchClient,MockHttpBackend*/
describe('Service: transport', function() {
  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  var mockBackend;
  beforeEach(module(function ($provide) {
    mockBackend = new MockHttpBackend();
    $provide.factory('httpClient', function () {
      return createFetchClient({
        fetch: mockBackend.fetch,
        jsonpRequest: mockBackend.jsonpRequest,
      });
    });
  }));

  var HttpGetTransportFactory;

  // instantiate service
  var transportSvc;

  beforeEach(inject(function (_HttpGetTransportFactory_) {
    HttpGetTransportFactory = _HttpGetTransportFactory_;
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


  it('ignores when a payload provided', async function () {
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = {'header': 1};
    var getTransport = new HttpGetTransportFactory();
    var payloadTemplate = {'test': 0};
    var payload = structuredClone(payloadTemplate);
    mockBackend.expectGET(url, {'header': 1}).respond(200, mockResultsTemplate);
    await getTransport.query(url, payload, headers);
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('can take options', async function () {
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = {'header': 1};
    var options = {option1: true, "option2":"hello"};
    var getTransport = new HttpGetTransportFactory(options);
    var payloadTemplate = {'test': 0};
    var payload = structuredClone(payloadTemplate);
    expect(getTransport.options()).toEqual(options);
    mockBackend.expectGET(url).respond(200, mockResultsTemplate);
    await getTransport.query(url, payload, headers);
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('A POST can be wrapped in a proxy', async function () {
    var url = 'http://es.splainer-search.com/foods/tacos/_search';
    var options = {
      apiMethod: 'POST',
      proxyUrl: 'http://localhost/proxy?url='
    };
    var transport = transportSvc.getTransport(options);

    var headers = {'header': 1};

    var payloadTemplate = {'test': 0};
    var payload = structuredClone(payloadTemplate);
    mockBackend.expectPOST('http://localhost/proxy?url=' + url).respond(200, mockResultsTemplate);
    await transport.query(url, payload, headers);
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('A GET can be wrapped in a proxy', async function () {
    var url = 'http://es.splainer-search.com/foods/tacos/_search';
    var options = {
      apiMethod: 'GET',
      proxyUrl: 'http://localhost/proxy/'
    };
    var transport = transportSvc.getTransport(options);

    var headers = {'header': 1};

    var payloadTemplate = {'test': 0};
    var payload = structuredClone(payloadTemplate);
    mockBackend.expectGET('http://localhost/proxy/' + url).respond(200, mockResultsTemplate);
    await transport.query(url, payload, headers);
    mockBackend.verifyNoOutstandingExpectation();
  });


});

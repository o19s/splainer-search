import { describe, it, expect, beforeEach } from 'vitest';
import { createFetchClient } from '../../services/httpClient.js';
import { MockHttpBackend } from './helpers/mockHttpBackend.js';
import { getTransportSvc, getHttpGetTransportFactory } from './helpers/serviceFactory.js';

describe('proxyTransport', () => {
  var mockBackend, httpClient, transportSvc, HttpGetTransportFactory;

  beforeEach(() => {
    mockBackend = new MockHttpBackend();
    httpClient = createFetchClient({
      fetch: mockBackend.fetch,
      jsonpRequest: mockBackend.jsonpRequest,
    });
    transportSvc = getTransportSvc(httpClient);
    HttpGetTransportFactory = getHttpGetTransportFactory(httpClient);
  });

  var mockResultsTemplate = {
    hits: {
      total: 2,
      'max_score': 1.0,
      hits: [{}]
    }
  };

  it('ignores when a payload provided', async () => {
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = {'header': 1};
    var getTransport = new HttpGetTransportFactory();
    var payload = structuredClone({'test': 0});
    mockBackend.expectGET(url, {'header': 1}).respond(200, mockResultsTemplate);
    await getTransport.query(url, payload, headers);
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('can take options', async () => {
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = {'header': 1};
    var options = {option1: true, "option2":"hello"};
    var getTransport = new HttpGetTransportFactory(options);
    var payload = structuredClone({'test': 0});
    expect(getTransport.options()).toEqual(options);
    mockBackend.expectGET(url).respond(200, mockResultsTemplate);
    await getTransport.query(url, payload, headers);
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('A POST can be wrapped in a proxy', async () => {
    var url = 'http://es.splainer-search.com/foods/tacos/_search';
    var options = {
      apiMethod: 'POST',
      proxyUrl: 'http://localhost/proxy?url='
    };
    var transport = transportSvc.getTransport(options);
    var headers = {'header': 1};
    var payload = structuredClone({'test': 0});
    mockBackend.expectPOST('http://localhost/proxy?url=' + url).respond(200, mockResultsTemplate);
    await transport.query(url, payload, headers);
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('A GET can be wrapped in a proxy', async () => {
    var url = 'http://es.splainer-search.com/foods/tacos/_search';
    var options = {
      apiMethod: 'GET',
      proxyUrl: 'http://localhost/proxy/'
    };
    var transport = transportSvc.getTransport(options);
    var headers = {'header': 1};
    var payload = structuredClone({'test': 0});
    mockBackend.expectGET('http://localhost/proxy/' + url).respond(200, mockResultsTemplate);
    await transport.query(url, payload, headers);
    mockBackend.verifyNoOutstandingExpectation();
  });
});

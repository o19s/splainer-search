import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFetchClient } from '../../services/httpClient.js';
import { MockHttpBackend } from './helpers/mockHttpBackend.js';
import { getTransportSvc } from './helpers/serviceFactory.js';

describe('transportSvc', () => {
  var mockBackend, httpClient, transportSvc;

  beforeEach(() => {
    mockBackend = new MockHttpBackend();
    httpClient = createFetchClient({
      fetch: mockBackend.fetch,
      jsonpRequest: mockBackend.jsonpRequest,
    });
    transportSvc = getTransportSvc(httpClient);
  });

  var mockResults = { hits: { total: 0, hits: [] } };

  it('selects POST transport by default', async () => {
    var url = 'http://es.example.com/i/_search';
    var transport = transportSvc.getTransport({});
    mockBackend.expectPOST(url).respond(200, mockResults);
    await transport.query(url, { query: { match_all: {} } }, {});
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('selects POST transport for explicit POST (any case)', async () => {
    var url = 'http://es.example.com/i/_search';
    var transport = transportSvc.getTransport({ apiMethod: 'post' });
    mockBackend.expectPOST(url).respond(200, mockResults);
    await transport.query(url, { query: { match_all: {} } }, {});
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('selects GET transport when apiMethod is GET (case-insensitive)', async () => {
    var url = 'http://es.example.com/i/_search';
    var transport = transportSvc.getTransport({ apiMethod: 'get' });
    mockBackend.expectGET(url).respond(200, mockResults);
    await transport.query(url, { x: 1 }, { Accept: 'application/json' });
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('selects JSONP transport when apiMethod is JSONP', async () => {
    var url = 'http://solr.example.com/select?q=*:*';
    var transport = transportSvc.getTransport({ apiMethod: 'jsonp' });
    mockBackend.expectJSONP(/^http:\/\/solr\.example\.com\/select\?q=\*:\*/).respond(200, mockResults);
    await transport.query(url, {}, {});
    mockBackend.verifyNoOutstandingExpectation();
  });

  describe('BULK transport (uses setTimeout)', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('routes BULK apiMethod through the bulk transport (batched POST to _msearch)', async () => {
      var url = 'http://es.example.com/_msearch';
      var transport = transportSvc.getTransport({ apiMethod: 'BULK' });
      var payload = { query: { match_all: {} } };
      var queryPromise = transport.query(url, payload, { 'Content-Type': 'application/x-ndjson' });
      mockBackend.expectPOST(url, function(body) {
        var lines = body.replace(/\n$/, '').split('\n');
        return lines.length === 2 &&
          JSON.stringify(JSON.parse(lines[0])) === JSON.stringify({}) &&
          JSON.stringify(JSON.parse(lines[1])) === JSON.stringify(payload);
      }).respond(200, { responses: [mockResults] });
      vi.advanceTimersByTime(100);
      await queryPromise;
      mockBackend.verifyNoOutstandingExpectation();
    });
  });
});

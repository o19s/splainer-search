import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getBulkTransportFactory } from './helpers/serviceFactory.js';
import { MockHttpBackend } from './helpers/mockHttpBackend.js';
import { createFetchClient } from '../../services/httpClient.js';

async function flushMicrotasks() {
  for (var i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('bulkTransportFactory', () => {
  var mockBackend, BulkTransportFactory;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBackend = new MockHttpBackend();
    var httpClient = createFetchClient({
      fetch: mockBackend.fetch,
      jsonpRequest: mockBackend.jsonpRequest,
    });
    BulkTransportFactory = getBulkTransportFactory(httpClient);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  var mockResultsTemplate = {
    hits: { total: 2, 'max_score': 1.0, hits: [{}] }
  };

  var mockResultsErrorTemplate = { error: 'Error for query' };

  var buildMockResults = function(howMany) {
    var results = { 'responses': [] };
    for (var i = 0; i < howMany; i++) {
      var mockResults = structuredClone(mockResultsTemplate);
      mockResults.hits.total = i;
      results.responses[i] = mockResults;
    }
    return results;
  };

  var hasExpectedJsonList = function(expectedObjects) {
    return {
      test: function(textSent) {
        if (!textSent.endsWith('\n')) { return false; }
        textSent = textSent.substring(0, textSent.length - 1);
        var sentObjs = textSent.split('\n');
        if (sentObjs.length !== expectedObjects.length) { return false; }
        for (var i = 0; i < sentObjs.length; i++) {
          var ithObj = JSON.parse(sentObjs[i]);
          if (JSON.stringify(expectedObjects[i]) !== JSON.stringify(ithObj)) { return false; }
        }
        return true;
      }
    };
  };

  var containsExpectedHeaders = function(expectedHeaders) {
    return function(headerSent) {
      var match = true;
      Object.keys(expectedHeaders).forEach(function(headerKey) {
        var headerValue = expectedHeaders[headerKey];
        if (!Object.hasOwn(headerSent, headerKey)) { match = false; }
        else if (headerSent[headerKey] !== headerValue) { match = false; }
      });
      return match;
    };
  };

  it('sends whats in queue after timeout', async () => {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var payloadTemplate = {'test': 0};
    var headers = {'header': 1};
    var expectedObjects = [];
    var numToQuery = 10;
    for (var i = 0; i < numToQuery; i++) {
      var payload = structuredClone(payloadTemplate);
      payload.test = i;
      bulkTransport.query(url, payload, headers);
      expectedObjects.push({});
      expectedObjects.push(payload);
    }
    var mockResults = buildMockResults(numToQuery);
    mockBackend.expectPOST(url, hasExpectedJsonList(expectedObjects), containsExpectedHeaders(headers))
      .respond(200, mockResults);
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('resolves whats in flight', async () => {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var payloadTemplate = {'test': 0};
    var headers = {'header': 1};
    var expectedObjects = [];
    var numToQuery = 10;
    var promisesResolved = 0;
    var mockResults = buildMockResults(numToQuery);

    var indivSuccessCheck = function(requestIdx) {
      return function(results) {
        expect(results.data).toEqual(mockResults.responses[requestIdx]);
        promisesResolved++;
      };
    };

    for (var i = 0; i < numToQuery; i++) {
      var payload = structuredClone(payloadTemplate);
      payload.test = i;
      bulkTransport.query(url, payload, headers).then(indivSuccessCheck(i));
      expectedObjects.push({});
      expectedObjects.push(payload);
    }
    mockBackend.expectPOST(url, hasExpectedJsonList(expectedObjects), containsExpectedHeaders(headers))
      .respond(200, mockResults);
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    mockBackend.verifyNoOutstandingExpectation();
    expect(promisesResolved).toBe(numToQuery);
  });

  it('rejects individual errors', async () => {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var payloadTemplate = {'test': 0};
    var headers = {'header': 1};
    var expectedObjects = [];
    var numToQuery = 10;
    var promisesResolved = 0;
    var promisesRejected = 0;
    var mockResults = buildMockResults(numToQuery);
    mockResults.responses[2] = structuredClone(mockResultsErrorTemplate);
    mockResults.responses[4] = structuredClone(mockResultsErrorTemplate);

    var indivSuccessCheck = function(requestIdx) {
      return function(results) {
        expect(results.data).toEqual(mockResults.responses[requestIdx]);
        promisesResolved++;
      };
    };
    var indivErrorCheck = function(requestIdx) {
      return function(results) {
        expect(results).toEqual(mockResults.responses[requestIdx]);
        promisesRejected++;
      };
    };

    for (var i = 0; i < numToQuery; i++) {
      var payload = structuredClone(payloadTemplate);
      payload.test = i;
      bulkTransport.query(url, payload, headers).then(indivSuccessCheck(i), indivErrorCheck(i));
      expectedObjects.push({});
      expectedObjects.push(payload);
    }
    mockBackend.expectPOST(url, hasExpectedJsonList(expectedObjects), containsExpectedHeaders(headers))
      .respond(200, mockResults);
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    mockBackend.verifyNoOutstandingExpectation();
    expect(promisesResolved).toBe(8);
    expect(promisesRejected).toBe(2);
  });

  it('rejects all on http errors', async () => {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var payloadTemplate = {'test': 0};
    var headers = {'header': 1};
    var expectedObjects = [];
    var numToQuery = 10;
    var promisesResolved = 0;
    var promisesRejected = 0;
    var mockResults = buildMockResults(numToQuery);

    var indivSuccessCheck = function(requestIdx) {
      return function(results) {
        expect(results.data).toEqual(mockResults.responses[requestIdx]);
        promisesResolved++;
      };
    };
    var indivErrorCheck = function() {
      return function() { promisesRejected++; };
    };

    for (var i = 0; i < numToQuery; i++) {
      var payload = structuredClone(payloadTemplate);
      payload.test = i;
      bulkTransport.query(url, payload, headers).then(indivSuccessCheck(i), indivErrorCheck(i));
      expectedObjects.push({});
      expectedObjects.push(payload);
    }
    mockBackend.expectPOST(url, hasExpectedJsonList(expectedObjects))
      .respond(400, {});
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    mockBackend.verifyNoOutstandingExpectation();
    expect(promisesResolved).toBe(0);
    expect(promisesRejected).toBe(numToQuery);
  });

  it('bulks requests serially', async () => {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var payloadTemplate = {'test': 0};
    var headers = {'header': 1};
    var expectedObjects = [];
    var numToQuery = 10;
    var promisesResolved = 0;
    var mockResults = buildMockResults(numToQuery);

    var indivSuccessCheck = function(requestIdx) {
      return function(results) {
        expect(results.data).toEqual(mockResults.responses[requestIdx]);
        promisesResolved++;
      };
    };

    var payload = {};
    for (var i = 0; i < numToQuery; i++) {
      payload = structuredClone(payloadTemplate);
      payload.test = i;
      bulkTransport.query(url, payload, headers).then(indivSuccessCheck(i));
      expectedObjects.push({});
      expectedObjects.push(payload);
    }
    mockBackend.expectPOST(url, hasExpectedJsonList(expectedObjects), containsExpectedHeaders(headers))
      .respond(200, mockResults);
    vi.advanceTimersByTime(100);

    var expectedObjectsBatch2 = [];
    for (i = 0; i < numToQuery; i++) {
      payload = structuredClone(payloadTemplate);
      payload.test = numToQuery + i;
      bulkTransport.query(url, payload, headers).then(indivSuccessCheck(i));
      expectedObjectsBatch2.push({});
      expectedObjectsBatch2.push(payload);
    }

    await flushMicrotasks();
    mockBackend.verifyNoOutstandingExpectation();
    expect(promisesResolved).toBe(numToQuery);

    mockBackend.expectPOST(url, hasExpectedJsonList(expectedObjectsBatch2), containsExpectedHeaders(headers))
      .respond(200, mockResults);
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    mockBackend.verifyNoOutstandingExpectation();
    expect(promisesResolved).toBe(numToQuery * 2);
  });

  it('doesnt issue http if nothing to send', async () => {
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = {'header': 1};
    var bulkTransport = new BulkTransportFactory();
    var payload = structuredClone({'test': 0});
    var mockResults = buildMockResults(1);
    bulkTransport.query(url, payload, headers);
    mockBackend.expectPOST(url).respond(200, mockResults);
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    mockBackend.verifyNoOutstandingExpectation();
    vi.advanceTimersByTime(100);
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('adds a trailing \\n', async () => {
    var trailingEndlineTest = {
      test: function(data) { return data.endsWith('\n'); }
    };
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = {'header': 1};
    var bulkTransport = new BulkTransportFactory();
    var payload = structuredClone({'test': 0});
    var mockResults = buildMockResults(1);
    bulkTransport.query(url, payload, headers);
    mockBackend.expectPOST(url, trailingEndlineTest).respond(200, mockResults);
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('changes URLs', async () => {
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = {'header': 1};
    var bulkTransport = new BulkTransportFactory();
    var payload = structuredClone({'test': 0});
    var mockResults = buildMockResults(1);
    bulkTransport.query(url, payload, headers);
    mockBackend.expectPOST(url).respond(200, mockResults);
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    mockBackend.verifyNoOutstandingExpectation();

    var url2 = 'http://es2.splainer-search.com/foods/tacos/_msearch';
    bulkTransport.query(url2, payload, headers);
    mockBackend.expectPOST(url2).respond(200, mockResults);
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
  });
});

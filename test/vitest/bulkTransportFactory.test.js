import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getBulkTransportFactory, getUtilsSvc } from './helpers/serviceFactory.js';
import { MockHttpBackend } from './helpers/mockHttpBackend.js';
import { createFetchClient } from '../../services/httpClient.js';
import { TransportFactory } from '../../factories/transportFactory.js';
import { BulkTransportFactory as BulkTransportFactoryFn } from '../../factories/bulkTransportFactory.js';

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

  it('rejects all when response body is not a sane _msearch payload (null data)', async () => {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = { header: 1 };
    var expectedObjects = [];
    var numToQuery = 2;
    var promisesRejected = 0;
    for (var i = 0; i < numToQuery; i++) {
      bulkTransport.query(url, { test: i }, headers).then(
        function () {},
        function () {
          promisesRejected++;
        },
      );
      expectedObjects.push({});
      expectedObjects.push({ test: i });
    }
    mockBackend.expectPOST(url, hasExpectedJsonList(expectedObjects), containsExpectedHeaders(headers)).respond(
      200,
      null,
    );
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    mockBackend.verifyNoOutstandingExpectation();
    expect(promisesRejected).toBe(numToQuery);
  });

  it('rejects all when responses length does not match batch size', async () => {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = { header: 1 };
    var expectedObjects = [];
    var numToQuery = 3;
    var promisesRejected = 0;
    for (var i = 0; i < numToQuery; i++) {
      bulkTransport.query(url, { test: i }, headers).then(
        function () {},
        function () {
          promisesRejected++;
        },
      );
      expectedObjects.push({});
      expectedObjects.push({ test: i });
    }
    var tooShort = { responses: [{ hits: { total: 1, hits: [] } }, { hits: { total: 1, hits: [] } }] };
    mockBackend.expectPOST(url, hasExpectedJsonList(expectedObjects), containsExpectedHeaders(headers)).respond(
      200,
      tooShort,
    );
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    mockBackend.verifyNoOutstandingExpectation();
    expect(promisesRejected).toBe(numToQuery);
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

  it('sends Content-Type application/x-ndjson when not provided', async () => {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var payload = structuredClone({ test: 0 });
    var mockResults = buildMockResults(1);
    bulkTransport.query(url, payload, {});
    mockBackend.expectPOST(
      url,
      function () { return true; },
      function (sent) {
        return sent['Content-Type'] === 'application/x-ndjson';
      }
    ).respond(200, mockResults);
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('preserves caller Content-Type when set (case-insensitive)', async () => {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var payload = structuredClone({ test: 0 });
    var customType = 'application/vnd.elasticsearch+x-ndjson; compatible-with=8';
    var mockResults = buildMockResults(1);
    bulkTransport.query(url, payload, { 'content-type': customType });
    mockBackend.expectPOST(
      url,
      function () { return true; },
      function (sent) {
        return sent['content-type'] === customType;
      }
    ).respond(200, mockResults);
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
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

  it('passes per-request AbortSignal through to bulk POST', async () => {
    var localBackend = new MockHttpBackend();
    var postedOpts = [];
    var rawFetch = localBackend.fetch.bind(localBackend);
    localBackend.fetch = function (urlArg, options) {
      if (options && options.method === 'POST') {
        postedOpts.push(options);
      }
      return rawFetch(urlArg, options);
    };
    var localClient = createFetchClient({
      fetch: localBackend.fetch,
      jsonpRequest: localBackend.jsonpRequest,
    });
    var BulkLocal = getBulkTransportFactory(localClient);
    var bulkTransport = new BulkLocal();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = { header: 1 };
    var ac = new AbortController();
    bulkTransport.query(url, { test: 0 }, headers, { signal: ac.signal });
    var mockResults = buildMockResults(1);
    localBackend.expectPOST(url).respond(200, mockResults);
    vi.advanceTimersByTime(100);
    await flushMicrotasks();
    localBackend.verifyNoOutstandingExpectation();
    expect(postedOpts.length).toBe(1);
    expect(postedOpts[0].signal).toBe(ac.signal);
  });

  var anySignalDesc = Object.getOwnPropertyDescriptor(AbortSignal, 'any');
  it.skipIf(!anySignalDesc || !anySignalDesc.configurable)(
    'combines multiple AbortSignals when AbortSignal.any is unavailable',
    async () => {
      var origAny = AbortSignal.any;
      Object.defineProperty(AbortSignal, 'any', {
        configurable: true,
        value: undefined,
        writable: true,
      });
      try {
        var localBackend = new MockHttpBackend();
        var postedOpts = [];
        var rawFetch = localBackend.fetch.bind(localBackend);
        localBackend.fetch = function (urlArg, options) {
          if (options && options.method === 'POST') {
            postedOpts.push(options);
          }
          return rawFetch(urlArg, options);
        };
        var localClient = createFetchClient({
          fetch: localBackend.fetch,
          jsonpRequest: localBackend.jsonpRequest,
        });
        var BulkLocal = getBulkTransportFactory(localClient);
        var bulkTransport = new BulkLocal();
        var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
        var headers = { header: 1 };
        var ac1 = new AbortController();
        var ac2 = new AbortController();
        bulkTransport.query(url, { test: 0 }, headers, { signal: ac1.signal });
        bulkTransport.query(url, { test: 1 }, headers, { signal: ac2.signal });
        var mockResults = buildMockResults(2);
        localBackend.expectPOST(url, hasExpectedJsonList([{}, { test: 0 }, {}, { test: 1 }])).respond(
          200,
          mockResults,
        );
        vi.advanceTimersByTime(100);
        await flushMicrotasks();
        localBackend.verifyNoOutstandingExpectation();
        expect(postedOpts.length).toBe(1);
        expect(postedOpts[0].signal).toBeDefined();
        expect(postedOpts[0].signal).not.toBe(ac1.signal);
        expect(postedOpts[0].signal).not.toBe(ac2.signal);
      } finally {
        if (origAny !== undefined) {
          Object.defineProperty(AbortSignal, 'any', {
            configurable: true,
            value: origAny,
            writable: true,
          });
        } else {
          delete AbortSignal.any;
        }
      }
    },
  );

  it('surfaces unexpected errors in the msearch success path via multiSearchFailed', async () => {
    var debugSpy = vi.spyOn(console, 'debug').mockImplementation(function () {});
    try {
      var utilsSvc = getUtilsSvc();
      var baseTransport = TransportFactory();
      var evilResp = {};
      Object.defineProperty(evilResp, 'data', {
        configurable: true,
        enumerable: true,
        get: function () {
          throw new Error('simulated success-handler failure');
        },
      });
      var httpClientStub = {
        post: vi.fn().mockResolvedValue(evilResp),
      };
      var BulkLocal = BulkTransportFactoryFn(baseTransport, httpClientStub, utilsSvc);
      var bulkTransport = new BulkLocal();
      var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
      var rejected = 0;
      bulkTransport.query(url, { test: 0 }, {}).then(
        function () {},
        function () {
          rejected++;
        },
      );
      vi.advanceTimersByTime(100);
      await flushMicrotasks();
      expect(rejected).toBe(1);
      expect(debugSpy).toHaveBeenCalled();
    } finally {
      debugSpy.mockRestore();
    }
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { createFetchClient } from '../../services/httpClient.js';
import { MockHttpBackend } from './helpers/mockHttpBackend.js';
import { getSearchSvc, getFieldSpecSvc } from './helpers/serviceFactory.js';
import { activeQueries } from '../../values/activeQueries.js';

describe('searchSvc: SearchApi', () => {
  var searchSvc;
  var fieldSpecSvc;
  var mockBackend;
  var mockFieldSpec;
  var mockSearchApiUrl = 'http://example.com:1234/api/search';
  var mockSearchApiParams = { query: '#$query##' };
  var expectedParams = structuredClone(mockSearchApiParams);
  var mockQueryText = 'rambo movie';
  expectedParams.query = encodeURIComponent(mockQueryText);

  var expectedPayload = { query: mockQueryText };
  var mockSearchApiResults = [
    { id: 1, title: 'Rambo', name: 'Rambo Collection' },
    { id: 2, title: 'Rambo II', name: 'Rambo Collection' },
  ];

  beforeEach(() => {
    mockBackend = new MockHttpBackend();
    var httpClient = createFetchClient({
      fetch: mockBackend.fetch,
      jsonpRequest: mockBackend.jsonpRequest,
    });
    searchSvc = getSearchSvc(httpClient);
    fieldSpecSvc = getFieldSpecSvc();
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1 hl:field2');
    activeQueries.count = 0;
  });

  it('access searchapi using GET', async () => {
    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      { apiMethod: 'GET' },
      'searchapi',
    );
    mockBackend
      .expectGET('http://example.com:1234/api/search?query=rambo movie')
      .respond(200, mockSearchApiResults);
    await searcher.search();
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('access searchapi using POST', async () => {
    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      { apiMethod: 'POST' },
      'searchapi',
    );
    mockBackend
      .expectPOST('http://example.com:1234/api/search', expectedPayload)
      .respond(200, mockSearchApiResults);
    await searcher.search();
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('returns number found', async () => {
    var options = { apiMethod: 'GET' };
    options.numberOfResultsMapper = function () {
      return 99;
    };

    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      options,
      'searchapi',
    );
    mockBackend
      .expectGET('http://example.com:1234/api/search?query=rambo movie')
      .respond(200, mockSearchApiResults);

    await searcher.search();
    mockBackend.verifyNoOutstandingExpectation();
    expect(searcher.numFound).toEqual(99);
  });

  it('returns docs', async () => {
    var options = { apiMethod: 'GET' };
    options.docsMapper = function (data) {
      var docs = [];
      for (var i = 0; i < data.length; i++) {
        docs.push({ id: data[i].id, name: data[i].name, title: data[i].title });
      }
      return docs;
    };

    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      options,
      'searchapi',
    );
    mockBackend
      .expectGET('http://example.com:1234/api/search?query=rambo movie')
      .respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search().then(function () {
      var docs = searcher.docs;
      expect(docs.length).toEqual(2);
      expect(docs[0].title).toEqual('Rambo');
      expect(docs[0].id).toEqual(1);
      expect(docs[1].title).toEqual('Rambo II');
      expect(docs[1].id).toEqual(2);
      called++;
    });
    mockBackend.verifyNoOutstandingExpectation();
    expect(called).toEqual(1);
  });

  it('respects numberOfRows configuration', async () => {
    var options = { apiMethod: 'GET', numberOfRows: 1 };
    options.docsMapper = function (data) {
      var docs = [];
      for (var i = 0; i < data.length; i++) {
        docs.push({ id: data[i].id, name: data[i].name, title: data[i].title });
      }
      return docs;
    };

    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      options,
      'searchapi',
    );
    mockBackend
      .expectGET('http://example.com:1234/api/search?query=rambo movie')
      .respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search().then(function () {
      var docs = searcher.docs;
      expect(docs.length).toEqual(1);
      expect(docs[0].title).toEqual('Rambo');
      expect(docs[0].id).toEqual(1);
      called++;
    });
    mockBackend.verifyNoOutstandingExpectation();
    expect(called).toEqual(1);
  });

  it('rejects on HTTP error and sets inError', async () => {
    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      { apiMethod: 'POST' },
      'searchapi',
    );
    mockBackend.expectPOST(mockSearchApiUrl).respond(500, { error: 'Server Error' });

    var errorCalled = 0;
    await searcher.search().then(
      function () {
        errorCalled--;
      },
      function (msg) {
        expect(msg.searchError).toContain('Error with Search API');
        expect(searcher.inError).toBe(true);
        errorCalled++;
      },
    );
    mockBackend.verifyNoOutstandingExpectation();
    expect(errorCalled).toEqual(1);
  });

  it('decrements activeQueries on error', async () => {
    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      { apiMethod: 'POST' },
      'searchapi',
    );
    var initialCount = activeQueries.count;
    mockBackend.expectPOST(mockSearchApiUrl).respond(500, {});
    await searcher.search().then(null, function () {});
    expect(activeQueries.count).toEqual(initialCount);
  });

  it('increments and decrements activeQueries on success', async () => {
    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      { apiMethod: 'GET' },
      'searchapi',
    );
    var initialCount = activeQueries.count;
    mockBackend
      .expectGET('http://example.com:1234/api/search?query=rambo movie')
      .respond(200, mockSearchApiResults);
    await searcher.search();
    expect(activeQueries.count).toEqual(initialCount);
  });

  it('warns but does not throw when docsMapper is undefined', async () => {
    var options = { apiMethod: 'GET' };
    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      options,
      'searchapi',
    );
    mockBackend
      .expectGET('http://example.com:1234/api/search?query=rambo movie')
      .respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search().then(function () {
      expect(searcher.docs.length).toEqual(0);
      called++;
    });
    mockBackend.verifyNoOutstandingExpectation();
    expect(called).toEqual(1);
  });

  it('warns but does not throw when numberOfResultsMapper is undefined', async () => {
    var options = { apiMethod: 'GET' };
    options.docsMapper = function (data) {
      return data.map(function (d) {
        return { id: d.id, title: d.title };
      });
    };
    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      options,
      'searchapi',
    );
    mockBackend
      .expectGET('http://example.com:1234/api/search?query=rambo movie')
      .respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search().then(function () {
      expect(searcher.numFound).toEqual(0);
      called++;
    });
    expect(called).toEqual(1);
  });

  it('stores lastResponse on success', async () => {
    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      { apiMethod: 'GET' },
      'searchapi',
    );
    mockBackend
      .expectGET('http://example.com:1234/api/search?query=rambo movie')
      .respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search().then(function () {
      expect(searcher.lastResponse).toBeDefined();
      expect(searcher.lastResponse.length).toEqual(2);
      called++;
    });
    expect(called).toEqual(1);
  });

  it('pager is a stub and returns null', () => {
    var options = { apiMethod: 'GET' };
    options.docsMapper = function (data) {
      return data.map(function (d) {
        return { id: d.id, title: d.title };
      });
    };
    options.numberOfResultsMapper = function (data) {
      return data.length;
    };

    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      options,
      'searchapi',
    );
    expect(searcher.pager()).toBeNull();
  });

  it('addDocToGroup is callable (stub implementation)', () => {
    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      { apiMethod: 'GET' },
      'searchapi',
    );
    expect(function () {
      searcher.addDocToGroup('field', 'g', { id: 1 });
    }).not.toThrow();
  });

  it('treats docsMapper returning null like an empty list', async () => {
    var options = {
      apiMethod: 'GET',
      docsMapper: function () {
        return null;
      },
      numberOfResultsMapper: function () {
        return 0;
      },
    };
    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      options,
      'searchapi',
    );
    mockBackend
      .expectGET('http://example.com:1234/api/search?query=rambo movie')
      .respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search().then(function () {
      expect(searcher.docs.length).toBe(0);
      called++;
    });
    expect(called).toBe(1);
  });

  it('handles docsMapper returning an empty array', async () => {
    var options = {
      apiMethod: 'GET',
      docsMapper: function () {
        return [];
      },
      numberOfResultsMapper: function () {
        return 0;
      },
    };
    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      options,
      'searchapi',
    );
    mockBackend
      .expectGET('http://example.com:1234/api/search?query=rambo movie')
      .respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search().then(function () {
      expect(searcher.docs.length).toBe(0);
      called++;
    });
    expect(called).toBe(1);
  });
});

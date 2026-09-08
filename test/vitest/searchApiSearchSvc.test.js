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
  var mockQueryText = 'rambo movie';
  // GET values are URL-encoded (values only, not keys); POST bodies are sent as-is.
  var expectedGetUrl = 'http://example.com:1234/api/search?query=' + encodeURIComponent(mockQueryText);

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
      .expectGET(expectedGetUrl)
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

  it('AUTO picks GET for a short query and POST for a long one', async () => {
    var shortSearcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      mockQueryText,
      { apiMethod: 'AUTO', maxGetUrlLength: 100 },
      'searchapi',
    );
    mockBackend.expectGET(expectedGetUrl).respond(200, mockSearchApiResults);
    await shortSearcher.search();
    mockBackend.verifyNoOutstandingExpectation();

    var longQueryText = 'a'.repeat(200);
    var longSearcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      mockSearchApiParams,
      longQueryText,
      { apiMethod: 'AUTO', maxGetUrlLength: 100 },
      'searchapi',
    );
    mockBackend
      .expectPOST(mockSearchApiUrl, { query: longQueryText })
      .respond(200, mockSearchApiResults);
    await longSearcher.search();
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
      .expectGET(expectedGetUrl)
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
      .expectGET(expectedGetUrl)
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
      .expectGET(expectedGetUrl)
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
      .expectGET(expectedGetUrl)
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
      .expectGET(expectedGetUrl)
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
      .expectGET(expectedGetUrl)
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
      .expectGET(expectedGetUrl)
      .respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search().then(function () {
      expect(searcher.lastResponse).toBeDefined();
      expect(searcher.lastResponse.length).toEqual(2);
      called++;
    });
    expect(called).toEqual(1);
  });

  it('pager returns null without a nextPageArgsMapper', () => {
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

  it('pager returns null when nextPageArgsMapper reports no more pages', () => {
    var options = {
      apiMethod: 'GET',
      numberOfRows: 10,
      nextPageArgsMapper: function () {
        return null;
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
    expect(searcher.pager()).toBeNull();
  });

  it('pager builds a new searcher from nextPageArgsMapper', async () => {
    var options = {
      apiMethod: 'POST',
      numberOfRows: 10,
      nextPageArgsMapper: function (args, numberOfRows) {
        return Object.assign({}, args, {
          hits: String(numberOfRows),
          offset: String((args.offset ? parseInt(args.offset, 10) : 0) + numberOfRows),
        });
      },
    };

    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      { query: '#$query##', offset: '0' },
      mockQueryText,
      options,
      'searchapi',
    );

    var nextSearcher = searcher.pager();
    expect(nextSearcher).not.toBeNull();
    expect(nextSearcher.args).toEqual({ query: '#$query##', hits: '10', offset: '10' });

    mockBackend
      .expectPOST(mockSearchApiUrl, { query: mockQueryText, offset: '10', hits: '10' })
      .respond(200, mockSearchApiResults);
    await nextSearcher.search();
    mockBackend.verifyNoOutstandingExpectation();
  });

  it("pager builds each GET page from the pristine base URL, not the previous page's built querystring", () => {
    // Regression test: prepareGetRequest (searchApiSearcherPreprocessorSvc.js) bakes the
    // querystring into searcher.url in place, so pager() must build the next page from
    // self.originalUrl (searcherFactory.js), not self.url - otherwise each page's params
    // pile up on top of every previous page's, instead of replacing them.
    var options = {
      apiMethod: 'GET',
      numberOfRows: 10,
      nextPageArgsMapper: function (args, numberOfRows) {
        return Object.assign({}, args, {
          hits: String(numberOfRows),
          offset: String((args.offset ? parseInt(args.offset, 10) : 0) + numberOfRows),
        });
      },
    };

    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockSearchApiUrl,
      { query: '#$query##', offset: '0' },
      mockQueryText,
      options,
      'searchapi',
    );

    var page2 = searcher.pager();
    expect(page2.url.match(/\?/g)).toHaveLength(1);
    expect(page2.url.match(/query=/g)).toHaveLength(1);
    expect(page2.url).toContain('offset=10');
    expect(page2.url).toContain('hits=10');

    var page3 = page2.pager();
    expect(page3.url.match(/\?/g)).toHaveLength(1);
    expect(page3.url.match(/query=/g)).toHaveLength(1);
    expect(page3.url).toContain('offset=20');
  });

  it('pager surfaces a thrown nextPageArgsMapper as a MapperError', () => {
    var options = {
      apiMethod: 'GET',
      numberOfRows: 10,
      nextPageArgsMapper: function () {
        throw new Error('boom');
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

    expect(function () {
      searcher.pager();
    }).toThrow(/MapperError/);
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
      .expectGET(expectedGetUrl)
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
      .expectGET(expectedGetUrl)
      .respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search().then(function () {
      expect(searcher.docs.length).toBe(0);
      called++;
    });
    expect(called).toBe(1);
  });
});

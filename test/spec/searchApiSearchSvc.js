'use strict';
/* global createFetchClient, MockHttpBackend */
describe('Service: searchSvc: SearchApi', function () {

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

  // instantiate service
  var searchSvc;
  var activeQueries;
  var fieldSpecSvc = null;
  var mockSearchApiUrl = 'http://example.com:1234/api/search';
  var mockSearchApiParams = {
    query: "#$query##"
  };
  var expectedParams = structuredClone(mockSearchApiParams);
  var mockQueryText = 'rambo movie';
  var mockFieldSpec = null;
  expectedParams.query = encodeURIComponent(mockQueryText);

  var expectedPayload = {
    "query": mockQueryText
  }
  var mockSearchApiResults = [
    {
      id: 1,
      title: "Rambo",
      name:  "Rambo Collection"
    },
    {
      id: 2,
      title: "Rambo II",
      name:  "Rambo Collection"
    }
  ]

  beforeEach(inject(function (_searchSvc_, _fieldSpecSvc_, _activeQueries_) {
    searchSvc     = _searchSvc_;
    fieldSpecSvc  = _fieldSpecSvc_;
    activeQueries = _activeQueries_;
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1 hl:field2');

    activeQueries.count = 0;
  }));


  it('access searchapi using GET', async function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
                                                mockSearchApiParams, mockQueryText, { apiMethod: 'GET' }, 'searchapi');

    mockBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);
    await searcher.search();
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('access searchapi using POST', async function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
                                                mockSearchApiParams, mockQueryText, { apiMethod: 'POST' }, 'searchapi');

    mockBackend.expectPOST("http://example.com:1234/api/search", expectedPayload).respond(200, mockSearchApiResults);
    await searcher.search();
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('returns number found', async function () {

    var options = { apiMethod: 'GET' };
    options.numberOfResultsMapper = function (_data) {
      // could have been _data.length
      return 99;
    }

    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
                                                mockSearchApiParams, mockQueryText, options, 'searchapi');

    mockBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    await searcher.search();

    mockBackend.verifyNoOutstandingExpectation();
    expect(searcher.numFound).toEqual(99);
  });

  it('returns docs', async function () {

    var options = { apiMethod: 'GET' };
    options.docsMapper = function(data){
      let docs = [];
      for (let doc of data) {
        docs.push ({
          id: doc.id,
          name: doc.name,
          title: doc.title,
        }
        )
      }
      return docs
    }


    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
                                                mockSearchApiParams, mockQueryText, options, 'searchapi');

    mockBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;

    await searcher.search()
        .then(function () {

          var docs = searcher.docs;
          expect(docs.length).toEqual(2);

          expect(docs[0].title).toEqual("Rambo");
          expect(docs[0].id).toEqual(1);
          expect(docs[1].title).toEqual("Rambo II");
          expect(docs[1].id).toEqual(2);

          called++;
        });

    mockBackend.verifyNoOutstandingExpectation();

    expect(called).toEqual(1);
  });

  it('respects numberOfRows configuration', async function () {

    var options = {
      apiMethod: 'GET',
      numberOfRows: 1
    };
    options.docsMapper = function(data){
      let docs = [];
      for (let doc of data) {
        docs.push ({
          id: doc.id,
          name: doc.name,
          title: doc.title,
        }
        )
      }
      return docs
    }

    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
                                                mockSearchApiParams, mockQueryText, options, 'searchapi');

    mockBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;

    await searcher.search()
        .then(function () {

          var docs = searcher.docs;
          expect(docs.length).toEqual(1); // Should only return 1 doc despite mockSearchApiResults having 2

          expect(docs[0].title).toEqual("Rambo");
          expect(docs[0].id).toEqual(1);

          called++;
        });

    mockBackend.verifyNoOutstandingExpectation();

    expect(called).toEqual(1);
  });

  it('rejects on HTTP error and sets inError', async function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, { apiMethod: 'POST' }, 'searchapi');

    mockBackend.expectPOST(mockSearchApiUrl).respond(500, { error: 'Server Error' });

    var errorCalled = 0;
    await searcher.search()
      .then(function() {
        errorCalled--;
      }, function(msg) {
        expect(msg.searchError).toContain('Error with Search API');
        expect(searcher.inError).toBe(true);
        errorCalled++;
      });

    mockBackend.verifyNoOutstandingExpectation();
    expect(errorCalled).toEqual(1);
  });

  it('decrements activeQueries on error', async function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, { apiMethod: 'POST' }, 'searchapi');

    var initialCount = activeQueries.count;
    mockBackend.expectPOST(mockSearchApiUrl).respond(500, {});

    await searcher.search().then(null, function() {});
    expect(activeQueries.count).toEqual(initialCount);
  });

  it('increments and decrements activeQueries on success', async function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, { apiMethod: 'GET' }, 'searchapi');

    var initialCount = activeQueries.count;
    mockBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    await searcher.search();
    expect(activeQueries.count).toEqual(initialCount);
  });

  it('warns but does not throw when docsMapper is undefined', async function() {
    var options = { apiMethod: 'GET' };
    // No docsMapper defined

    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, options, 'searchapi');

    mockBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search()
      .then(function() {
        // Should succeed but have no docs
        expect(searcher.docs.length).toEqual(0);
        called++;
      });

    mockBackend.verifyNoOutstandingExpectation();
    expect(called).toEqual(1);
  });

  it('warns but does not throw when numberOfResultsMapper is undefined', async function() {
    var options = { apiMethod: 'GET' };
    options.docsMapper = function(data) {
      return data.map(function(d) { return { id: d.id, title: d.title }; });
    };

    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, options, 'searchapi');

    mockBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search()
      .then(function() {
        // numFound stays at base-initialized value of 0 when no mapper is defined
        expect(searcher.numFound).toEqual(0);
        called++;
      });

    expect(called).toEqual(1);
  });

  it('stores lastResponse on success', async function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, { apiMethod: 'GET' }, 'searchapi');

    mockBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search().then(function() {
      expect(searcher.lastResponse).toBeDefined();
      expect(searcher.lastResponse.length).toEqual(2);
      called++;
    });

    expect(called).toEqual(1);
  });

  it('pager is a stub and returns null (same as other backends when there is no next page)', function() {
    var options = { apiMethod: 'GET' };
    options.docsMapper = function(data) {
      return data.map(function(d) { return { id: d.id, title: d.title }; });
    };
    options.numberOfResultsMapper = function(data) { return data.length; };

    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, options, 'searchapi');

    expect(searcher.pager()).toBeNull();
  });

  it('addDocToGroup is callable (stub implementation)', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, { apiMethod: 'GET' }, 'searchapi');
    expect(function() {
      searcher.addDocToGroup('field', 'g', { id: 1 });
    }).not.toThrow();
  });

  it('treats docsMapper returning null like an empty list (angular.forEach no-op)', async function() {
    var options = {
      apiMethod: 'GET',
      docsMapper: function() { return null; },
      numberOfResultsMapper: function() { return 0; },
    };
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, options, 'searchapi');

    mockBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search().then(function() {
      expect(searcher.docs.length).toBe(0);
      called++;
    });
    expect(called).toBe(1);
  });

  it('handles docsMapper returning an empty array', async function() {
    var options = {
      apiMethod: 'GET',
      docsMapper: function() { return []; },
      numberOfResultsMapper: function() { return 0; },
    };
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, options, 'searchapi');

    mockBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;
    await searcher.search().then(function() {
      expect(searcher.docs.length).toBe(0);
      called++;
    });
    expect(called).toBe(1);
  });
});

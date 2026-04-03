'use strict';
/* global urlContainsParams, urlMissingParams, mockExplainOther*/
/*global describe,beforeEach,inject,it,expect*/
describe('Service: searchSvc: SearchApi', function () {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  // instantiate service
  var searchSvc;
  var activeQueries;
  var $httpBackend = null;
  var fieldSpecSvc = null;
  var mockSearchApiUrl = 'http://example.com:1234/api/search';
  var mockSearchApiParams = {
    query: "#$query##"
  };
  var expectedParams = angular.copy(mockSearchApiParams);
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

  beforeEach(inject(function($injector) {
    $httpBackend = $injector.get('$httpBackend');
  }));

  beforeEach(inject(function (_searchSvc_, _fieldSpecSvc_, _activeQueries_) {
    searchSvc     = _searchSvc_;
    fieldSpecSvc  = _fieldSpecSvc_;
    activeQueries = _activeQueries_;
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1 hl:field2');

    activeQueries.count = 0;
  }));


  it('access searchapi using GET', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
                                                mockSearchApiParams, mockQueryText, { apiMethod: 'GET' }, 'searchapi');
    
    $httpBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);
    searcher.search();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });
  
  it('access searchapi using POST', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
                                                mockSearchApiParams, mockQueryText, { apiMethod: 'POST' }, 'searchapi');
    
    $httpBackend.expectPOST("http://example.com:1234/api/search", expectedPayload).respond(200, mockSearchApiResults);
    searcher.search();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });  
  
  it('returns number found', function () {
    
    var options = { apiMethod: 'GET' };
    options.numberOfResultsMapper = function(data){
      // could have been data.length
      return 99;
    }
    
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
                                                mockSearchApiParams, mockQueryText, options, 'searchapi');
    
    $httpBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    searcher.search();
    
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    expect(searcher.numFound).toEqual(99);
  });
  
  it('returns docs', function () {
    
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
    
    $httpBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;

    searcher.search()
        .then(function () {

          var docs = searcher.docs;
          expect(docs.length === 2);

          expect(docs[0].title).toEqual("Rambo");
          expect(docs[0].id).toEqual(1);
          expect(docs[1].title).toEqual("Rambo II");
          expect(docs[1].id).toEqual(2);                
          
          called++;
        });
    
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();

    expect(called).toEqual(1);
  });
  
  it('respects numberOfRows configuration', function () {
    
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
    
    $httpBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;

    searcher.search()
        .then(function () {

          var docs = searcher.docs;
          expect(docs.length).toEqual(1); // Should only return 1 doc despite mockSearchApiResults having 2

          expect(docs[0].title).toEqual("Rambo");
          expect(docs[0].id).toEqual(1);
          
          called++;
        });
    
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();

    expect(called).toEqual(1);
  });

  it('rejects on HTTP error and sets inError', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, { apiMethod: 'POST' }, 'searchapi');

    $httpBackend.expectPOST(mockSearchApiUrl).respond(500, { error: 'Server Error' });

    var errorCalled = 0;
    searcher.search()
      .then(function() {
        errorCalled--;
      }, function(msg) {
        expect(msg.searchError).toContain('Error with Search API');
        expect(searcher.inError).toBe(true);
        errorCalled++;
      });

    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    expect(errorCalled).toEqual(1);
  });

  it('decrements activeQueries on error', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, { apiMethod: 'POST' }, 'searchapi');

    var initialCount = activeQueries.count;
    $httpBackend.expectPOST(mockSearchApiUrl).respond(500, {});

    searcher.search().then(null, function() {});
    $httpBackend.flush();
    expect(activeQueries.count).toEqual(initialCount);
  });

  it('increments and decrements activeQueries on success', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, { apiMethod: 'GET' }, 'searchapi');

    var initialCount = activeQueries.count;
    $httpBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    searcher.search();
    $httpBackend.flush();
    expect(activeQueries.count).toEqual(initialCount);
  });

  it('warns but does not throw when docsMapper is undefined', function() {
    var options = { apiMethod: 'GET' };
    // No docsMapper defined

    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, options, 'searchapi');

    $httpBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;
    searcher.search()
      .then(function() {
        // Should succeed but have no docs
        expect(searcher.docs.length).toEqual(0);
        called++;
      });

    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    expect(called).toEqual(1);
  });

  it('warns but does not throw when numberOfResultsMapper is undefined', function() {
    var options = { apiMethod: 'GET' };
    options.docsMapper = function(data) {
      return data.map(function(d) { return { id: d.id, title: d.title }; });
    };

    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, options, 'searchapi');

    $httpBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;
    searcher.search()
      .then(function() {
        // numFound stays at base-initialized value of 0 when no mapper is defined
        expect(searcher.numFound).toEqual(0);
        called++;
      });

    $httpBackend.flush();
    expect(called).toEqual(1);
  });

  it('stores lastResponse on success', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, { apiMethod: 'GET' }, 'searchapi');

    $httpBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;
    searcher.search().then(function() {
      expect(searcher.lastResponse).toBeDefined();
      expect(searcher.lastResponse.length).toEqual(2);
      called++;
    });

    $httpBackend.flush();
    expect(called).toEqual(1);
  });

  it('pager is currently a stub and returns undefined', function() {
    var options = { apiMethod: 'GET' };
    options.docsMapper = function(data) {
      return data.map(function(d) { return { id: d.id, title: d.title }; });
    };
    options.numberOfResultsMapper = function(data) { return data.length; };

    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, options, 'searchapi');

    expect(searcher.pager()).toBeUndefined();
  });

  it('addDocToGroup is callable (stub implementation)', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, { apiMethod: 'GET' }, 'searchapi');
    expect(function() {
      searcher.addDocToGroup('field', 'g', { id: 1 });
    }).not.toThrow();
  });

  it('treats docsMapper returning null like an empty list (angular.forEach no-op)', function() {
    var options = {
      apiMethod: 'GET',
      docsMapper: function() { return null; },
      numberOfResultsMapper: function() { return 0; },
    };
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, options, 'searchapi');

    $httpBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;
    searcher.search().then(function() {
      expect(searcher.docs.length).toBe(0);
      called++;
    });
    $httpBackend.flush();
    expect(called).toBe(1);
  });

  it('handles docsMapper returning an empty array', function() {
    var options = {
      apiMethod: 'GET',
      docsMapper: function() { return []; },
      numberOfResultsMapper: function() { return 0; },
    };
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
      mockSearchApiParams, mockQueryText, options, 'searchapi');

    $httpBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);

    var called = 0;
    searcher.search().then(function() {
      expect(searcher.docs.length).toBe(0);
      called++;
    });
    $httpBackend.flush();
    expect(called).toBe(1);
  });
});

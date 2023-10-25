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

    // var called = 0;

    // searcher.search()
    //     .then(function () {
    //       console.log("I found " + searcher.numFound);
    //       expect(searcher.numFound).toEqual(99);
    //       // var docs = searcher.docs;
    //       // expect(docs.length === 2);

    //       // expect(docs[0].title).toEqual("Rambo");
    //       // expect(docs[0].id).toEqual(1);
    //       // expect(docs[1].title).toEqual("Rambo II");
    //       // expect(docs[1].id).toEqual(2);
    //       called++;
    //     });
    
    searcher.search();
    
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    expect(searcher.numFound).toEqual(99);
  //  expect(called).toEqual(1);
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
});

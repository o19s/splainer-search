'use strict';
/* global urlContainsParams, urlMissingParams, mockExplainOther*/
/*global describe,beforeEach,inject,it,expect*/
fdescribe('Service: searchSvc: SearchApi', function () {

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
      title: "rambo",
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


  it('access searchapi with using GET', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
                                                mockSearchApiParams, mockQueryText, { apiMethod: 'GET' }, 'searchapi');
    
    $httpBackend.expectGET("http://example.com:1234/api/search?query=rambo movie").respond(200, mockSearchApiResults);
    searcher.search();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });
  
  it('access searchapi with using POST', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
                                                mockSearchApiParams, mockQueryText, { apiMethod: 'POST' }, 'searchapi');
    
    $httpBackend.expectPOST("http://example.com:1234/api/search", expectedPayload).respond(200, mockSearchApiResults);
    searcher.search();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });  
});

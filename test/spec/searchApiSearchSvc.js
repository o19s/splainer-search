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
    query: ['#$query##']
  };
  var expectedParams = angular.copy(mockSearchApiParams);
  var mockQueryText = 'rambo movie';
  var mockFieldSpec = null;
  expectedParams.query[0] = encodeURIComponent(mockQueryText);
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
    // By default we talk to Solr with JSONP because Solr doesn't support cors.  However, if you
    // want your Search API to look like Solr to Quepid, well, you don't need clunky JSONP.
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSearchApiUrl,
                                                mockSearchApiParams, mockQueryText, { apiMethod: 'GET' }, 'searchapi');
    
    console.log("searcher:")
    console.log(searcher)
    
    $httpBackend.expectGET("http://example.com:1234/api/search?query=rambo%20movie").respond(200, mockSearchApiResults);
      //$httpBackend.expectGET(urlContainsParams(mockSearchApiParams, expectedParams))
      //                      .respond(200, mockResults);
    searcher.search();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });
});

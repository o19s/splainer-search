'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Service: elasticSearchSvc', function() {
  
  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  var esSearchSvc = null;
  var $httpBackend = null;
  var fieldSpecSvc = null;
  var mockEsUrl = 'http://localhost:9200/statedecoded/_search';
  var mockFieldSpec = null;
  var mockQueryText = 'elastic';
  var mockEsParams = {
    query: {
      term: {
        text: '#$query##'
      }
    }
  };


  beforeEach(inject(function($injector) {
    $httpBackend = $injector.get('$httpBackend');
  }));
  
  beforeEach(inject(function (_esSearchSvc_, _fieldSpecSvc_) {
    esSearchSvc = _esSearchSvc_;
    fieldSpecSvc = _fieldSpecSvc_;
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1');
  }));

  var mockResults = {
    hits: {
      total: 2,
      'max_score': 1.0,
      hits: [{
        '_index': 'statedecoded',
        '_type': 'law',
        '_id': 'l_1',
        '_score': 5.0,
        '_source': {
          'field': '1--field value',
          'field1': '1--field1 value'
        },

      },
       {'_index': 'statedecoded',
        '_type': 'law',
        '_id': 'l_1',
        '_score': 3.0,
        '_source': {
          'field': '2--field value',
          'field1': '2--field1 value'
        }
       }
      ]
    }
  };

  it('accesses es with mock es params', function() {
    var searcher = esSearchSvc.createSearcher(mockFieldSpec.fieldList, mockEsUrl,
                                              mockEsParams, mockQueryText);
    $httpBackend.expectPOST(mockEsUrl, function verifyDataSent(data) {
      var esQuery = angular.fromJson(data);
      return (esQuery.query.term.text === mockQueryText);
    }).
    respond(200, mockResults);
    searcher.search();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });
  
  it('returns docs (they should look just like solrDocs)', function() {
    var searcher = esSearchSvc.createSearcher(mockFieldSpec.fieldList, mockEsUrl,
                                              mockEsParams, mockQueryText);
    $httpBackend.expectPOST(mockEsUrl).
    respond(200, mockResults);
    var called = 0;
    searcher.search()
    .then(function() {
      var docs = searcher.docs;
      expect(docs.length === 2);
      expect(docs[0].field).toEqual(mockResults.hits.hits[0]._source.field);
      expect(docs[0].field1).toEqual(mockResults.hits.hits[0]._source.field1);
      expect(docs[1].field).toEqual(mockResults.hits.hits[1]._source.field);
      expect(docs[1].field1).toEqual(mockResults.hits.hits[1]._source.field1);
      called++;
    });
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    expect(called).toEqual(1);
  });


  describe('explain info', function() {
    var basicExplain1 = {
      match: true,
      value: 1.5,
      description: 'weight(text:law in 1234)',
      details: []
    };
    var basicExplain2 = {
      match: true,
      value: 0.5,
      description: 'weight(text:order in 1234)',
      details: []
    };

    var sumExplain = {
      match: true,
      value: 1.0,
      description: 'sum of',
      details: [basicExplain1, basicExplain2]
    };
    
    it('asks for explain', function() {
      var searcher = esSearchSvc.createSearcher(mockFieldSpec.fieldList, mockEsUrl,
                                                mockEsParams, mockQueryText);
      $httpBackend.expectPOST(mockEsUrl, function verifyDataSent(data) {
        var esQuery = angular.fromJson(data);
        return (esQuery.hasOwnProperty('explain') && esQuery.explain === true);
      }).
      respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('it populates explain', function() {
      var searcher = esSearchSvc.createSearcher(mockFieldSpec.fieldList, mockEsUrl,
                                                mockEsParams, mockQueryText);
      var mockResultsWithExpl = angular.copy(mockResults);
      mockResultsWithExpl.hits.hits[0]._explanation = sumExplain;
      var called = 0;
      $httpBackend.expectPOST(mockEsUrl).
        respond(200, mockResultsWithExpl);
      searcher.search()
      .then(function() {
        var docs = searcher.docs;
        expect(docs[0].explain()).toEqual(sumExplain);
        expect(docs[1].explain()).toBe(null);
        called++;
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);

    });
    
  });


});

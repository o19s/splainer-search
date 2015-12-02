'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Service: searchSvc: ElasticSearch', function() {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  var searcher;
  var searchSvc;
  var $httpBackend;
  var fieldSpecSvc  = null;
  var mockEsUrl     = 'http://localhost:9200/statedecoded/_search';
  var mockFieldSpec = null;
  var mockQueryText = 'elastic';
  var mockEsParams  = {
    query: {
      term: {
        text: '#$query##'
      }
    }
  };

  beforeEach(inject(function($injector) {
    $httpBackend = $injector.get('$httpBackend');
  }));

  beforeEach(inject(function (_searchSvc_, _fieldSpecSvc_) {
    searchSvc     = _searchSvc_;
    fieldSpecSvc  = _fieldSpecSvc_;
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1');
  }));

  var mockResults = {
    hits: {
      total: 2,
      'max_score': 1.0,
      hits: [
        {
          '_index': 'statedecoded',
          '_type':  'law',
          '_id':    'l_1',
          '_score': 5.0,
          'fields': {
            'field':  ['1--field value'],
            'field1': ['1--field1 value']
          },
        },
        {
          '_index': 'statedecoded',
          '_type':  'law',
          '_id':    'l_1',
          '_score': 3.0,
          'fields': {
            'field':  ['2--field value'],
            'field1': ['2--field1 value']
          }
        }
      ]
    }
  };

  describe('basic search', function () {
    beforeEach(inject(function () {
      searcher = searchSvc.createSearcher(
        mockFieldSpec.fieldList,
        mockEsUrl,
        mockEsParams,
        mockQueryText,
        {},
        'es'
      );
    }));

    it('accesses es with mock es params', function () {
      $httpBackend.expectPOST(mockEsUrl, function verifyDataSent(data) {
        var esQuery = angular.fromJson(data);
        return (esQuery.query.term.text === mockQueryText);
      }).
      respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('returns docs (they should look just like ES docs)', function() {
      $httpBackend.expectPOST(mockEsUrl).
      respond(200, mockResults);

      var called = 0;

      searcher.search()
      .then(function() {
        var docs = searcher.docs;
        expect(docs.length === 2);
        expect(docs[0].field).toEqual(mockResults.hits.hits[0].fields.field[0]);
        expect(docs[0].field1).toEqual(mockResults.hits.hits[0].fields.field1[0]);
        expect(docs[1].field).toEqual(mockResults.hits.hits[1].fields.field[0]);
        expect(docs[1].field1).toEqual(mockResults.hits.hits[1].fields.field1[0]);
        called++;
      });

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });

    it('reports errors for the search', function() {
      var errorMsg = 'your query just plain stunk';
      $httpBackend.expectPOST(mockEsUrl).
      respond(400, errorMsg);

      var errorCalled = 0;

      searcher.search()
      .then(function success() {
        errorCalled--;
      }, function failure(msg) {
        expect(msg.data).toBe(errorMsg);
        errorCalled++;
      });

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(errorCalled).toEqual(1);
    });

    it('sets the proper headers for auth', function() {
      searcher = searchSvc.createSearcher(
        mockFieldSpec.fieldList,
        'http://username:password@localhost:9200/statedecoded/_search',
        mockEsParams,
        mockQueryText,
        {},
        'es'
      );

      $httpBackend.expectPOST(mockEsUrl, undefined, function(headers) {
        return headers['Authorization'] == 'Basic ' + btoa('username:password');
      }).
      respond(200, mockResults);

      var called = 0;

      searcher.search()
      .then(function() {
        var docs = searcher.docs;
        expect(docs.length === 2);
        expect(docs[0].field).toEqual(mockResults.hits.hits[0].fields.field[0]);
        expect(docs[0].field1).toEqual(mockResults.hits.hits[0].fields.field1[0]);
        expect(docs[1].field).toEqual(mockResults.hits.hits[1].fields.field[0]);
        expect(docs[1].field1).toEqual(mockResults.hits.hits[1].fields.field1[0]);
        called++;
      });

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });
  });

  describe('explain info', function() {
    beforeEach(inject(function () {
      searcher = searchSvc.createSearcher(
        mockFieldSpec.fieldList,
        mockEsUrl,
        mockEsParams,
        mockQueryText,
        {},
        'es'
      );
    }));

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

  describe('url', function() {
    beforeEach(inject(function () {
      mockFieldSpec = fieldSpecSvc.createFieldSpec('id:_id title');
      mockEsUrl     = 'http://localhost:9200/tmdb/_search';

      searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsParams,
        mockQueryText,
        {},
        'es'
      );
    }));

    var fullResponse = {
      hits: {
        hits: [
          {
            _score: 6.738184,
            _type:  "movie",
            _id:    "AU8pXbemwjf9yCj9Xh4e",
            _source: {
              poster_path:  "/nwCm80TFvA7pQAQdcGHs69ZeGOK.jpg",
              title:        "Rambo",
              id:           5039,
              name:         "Rambo Collection"
            },
            _index: "tmdb",
            highlight: {
              title: [
                "<em>Rambo</em>"
              ]
            }
          },
          {
            _score:   4.1909046,
            _type:    "movie",
            _id:      "AU8pXau9wjf9yCj9Xhug",
            _source: {
              poster_path:  "/cUJgu5U6MHj9GF1weNtIPvN3IoS.jpg",
              id:           1370,
              title:        "Rambo III"
            },
            _index: "tmdb"
          }
        ],
        total:      2,
        max_score:  6.738184
      },
      _shards: {
        successful: 5,
        failed:     0,
        total:      5
      },
      took:       88,
      timed_out:  false
    };

    it('returns the proper url for the doc', function() {
      $httpBackend.expectPOST(mockEsUrl).respond(200, fullResponse);

      var called = 0;
      searcher.search().then(function() {
        called++;
        var docs = searcher.docs;
        var expectedUrl = 'http://localhost:9200/tmdb/movie/AU8pXbemwjf9yCj9Xh4e';
        expect(docs[0].url()).toEqual(expectedUrl);
      });

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });
  });

  describe('highlights', function() {
    beforeEach(inject(function () {
      mockFieldSpec = fieldSpecSvc.createFieldSpec('id:_id title');

      searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsParams,
        mockQueryText,
        {},
        'es'
      );
    }));

    var fullResponse = {
      hits: {
        hits: [
          {
            _score: 6.738184,
            _type:  "movie",
            _id:    "AU8pXbemwjf9yCj9Xh4e",
            _source: {
              poster_path:  "/nwCm80TFvA7pQAQdcGHs69ZeGOK.jpg",
              title:        "Rambo",
              id:           5039,
              name:         "Rambo Collection"
            },
            _index: "tmdb",
            highlight: {
              title: [
                "<em>Rambo</em>"
              ]
            }
          },
          {
            _score:   4.1909046,
            _type:    "movie",
            _id:      "AU8pXau9wjf9yCj9Xhug",
            _source: {
              poster_path:  "/cUJgu5U6MHj9GF1weNtIPvN3IoS.jpg",
              id:           1370,
              title:        "Rambo III"
            },
            _index: "tmdb"
          }
        ],
        total:      2,
        max_score:  6.738184
      },
      _shards: {
        successful: 5,
        failed:     0,
        total:      5
      },
      took:       88,
      timed_out:  false
    };

    it('gets highlight snippet field values if returned', function() {
      $httpBackend.expectPOST(mockEsUrl).respond(200, fullResponse);

      var called = 0;
      searcher.search().then(function() {
        called++;
        var docs = searcher.docs;
        var expectedSnip  = ["<em>Rambo</em>"];
        var expectedHl    = ["<b>Rambo</b>"];
        expect(docs[0].snippet("AU8pXbemwjf9yCj9Xh4e", 'title')).toEqual(expectedSnip);
        expect(docs[0].highlight("AU8pXbemwjf9yCj9Xh4e", 'title', '<b>', '</b>')).toEqual(expectedHl);
      });

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('returns null if no highlights for field', function() {
      $httpBackend.expectPOST(mockEsUrl).respond(200, fullResponse);

      var called = 0;
      searcher.search().then(function() {
        called++;
        var docs = searcher.docs;
        var expectedSnip  = null;
        var expectedHl    = null;
        expect(docs[0].snippet("AU8pXbemwjf9yCj9Xh4e", 'foo')).toEqual(expectedSnip);
        expect(docs[0].highlight("AU8pXbemwjf9yCj9Xh4e", 'foo', '<b>', '</b>')).toEqual(expectedHl);
      });

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('returns null if no highlights', function() {
      $httpBackend.expectPOST(mockEsUrl).respond(200, fullResponse);

      var called = 0;
      searcher.search().then(function() {
        called++;
        var docs = searcher.docs;
        var expectedSnip  = null;
        var expectedHl    = null;
        expect(docs[1].snippet("AU8pXbemwjf9yCj9Xh4e", 'foo')).toEqual(expectedSnip);
        expect(docs[1].highlight("AU8pXbemwjf9yCj9Xh4e", 'foo', '<b>', '</b>')).toEqual(expectedHl);
      });

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });
  });

  describe('vars', function() {
    it('replaces vars no URI encode', function() {
      var mockQueryText = 'taco&burrito';
      var mockEsParams  = {
        query: {
          term: {
            text: '#$query##'
          }
        }
      };
      var searcher = searchSvc.createSearcher(
        mockFieldSpec.fieldList,
        mockEsUrl,
        mockEsParams,
        mockQueryText,
        {},
        'es'
      );
      $httpBackend.expectPOST(mockEsUrl, function verifyDataSent(data) {
        var esQuery = angular.fromJson(data);
        return (esQuery.query.term.text === mockQueryText);
      }).
      respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('replaces keywords vars', function() {
      var mockQueryText = 'taco&burrito purina headphone';
      var mockEsParams  = {
        query: {
          term: {
            text: '#$query1## #$query## #$query2##'
          }
        }
      };
      var searcher = searchSvc.createSearcher(
        mockFieldSpec.fieldList,
        mockEsUrl,
        mockEsParams,
        mockQueryText,
        {},
        'es'
      );
      $httpBackend.expectPOST(mockEsUrl, function verifyDataSent(data) {
        var esQuery = angular.fromJson(data);
        return (esQuery.query.term.text === 'taco&burrito taco&burrito purina headphone purina');
      }).
      respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('null queryText', function() {
      var mockQueryText = 'taco&burrito purina headphone';
      var mockEsParams  = {
        query: {
          term: {
            text: 'lovely bunnies'
          }
        }
      };
      var searcher = searchSvc.createSearcher(
        mockFieldSpec.fieldList,
        mockEsUrl,
        mockEsParams,
        null,
        {},
        'es'
      );
      $httpBackend.expectPOST(mockEsUrl, function verifyDataSent(data) {
        var esQuery = angular.fromJson(data);
        return (esQuery.query.term.text === 'lovely bunnies');
      }).
      respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('empty query turns to quotes', function() {
      var mockQueryText = 'purina headphone';
      var mockEsParams  = {
        query: {
          term: {
            text: '#$query1## #$query3##'
          }
        }
      };
      var searcher = searchSvc.createSearcher(
        mockFieldSpec.fieldList,
        mockEsUrl,
        mockEsParams,
        mockQueryText,
        {},
        'es'
      );
      $httpBackend.expectPOST(mockEsUrl, function verifyDataSent(data) {
        var esQuery = angular.fromJson(data);
        console.log(esQuery.query.term.text);
        return (esQuery.query.term.text === 'purina \"\"');
      }).
      respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });
  });

  describe('paging', function() {
    var fullResponse = {
      hits: {
        hits: [
          {
            _score: 6.738184,
            _type:  "movie",
            _id:    "AU8pXbemwjf9yCj9Xh4e",
            _source: {
              poster_path:  "/nwCm80TFvA7pQAQdcGHs69ZeGOK.jpg",
              title:        "Rambo",
              id:           5039,
              name:         "Rambo Collection"
            },
            _index: "tmdb",
            highlight: {
              title: [
                "<em>Rambo</em>"
              ]
            }
          },
          {
            _score:   4.1909046,
            _type:    "movie",
            _id:      "AU8pXau9wjf9yCj9Xhug",
            _source: {
              poster_path:  "/cUJgu5U6MHj9GF1weNtIPvN3IoS.jpg",
              id:           1370,
              title:        "Rambo III"
            },
            _index: "tmdb"
          }
        ],
        total:      30,
        max_score:  6.738184
      },
      _shards: {
        successful: 5,
        failed:     0,
        total:      5
      },
      took:       88,
      timed_out:  false
    };

    beforeEach(inject(function () {
      mockFieldSpec = fieldSpecSvc.createFieldSpec('id:_id title');

      searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsParams,
        mockQueryText,
        {},
        'es'
      );
    }));

    function pagerValidator(expectedPagerParams) {
      return {
        test: function(data) {
          var data = JSON.parse(data);
          return (data.from === expectedPagerParams.from) && (data.size === expectedPagerParams.size);
        }
      }
    };

    it('pages on page', function() {
      $httpBackend.expectPOST(mockEsUrl).respond(200, fullResponse);

      searcher.search();
      $httpBackend.flush();

      // get page 2
      var nextSearcher = searcher.pager();
      var expectedPageParams = {
        size: 10,
        from: 10
      };

      $httpBackend.expectPOST(mockEsUrl, pagerValidator(expectedPageParams))
        .respond(200, fullResponse);

      nextSearcher.search();
      $httpBackend.flush();

      // get page 3
      nextSearcher = nextSearcher.pager();
      expectedPageParams = {
        size: 10,
        from: 20
      };

      $httpBackend.expectPOST(mockEsUrl, pagerValidator(expectedPageParams))
        .respond(200, fullResponse);

      nextSearcher.search();
      $httpBackend.flush();

      // done
      nextSearcher = nextSearcher.pager();
      expect(nextSearcher).toBe(null);
    });
  });

  describe('failures', function () {
    beforeEach(inject(function () {
      searcher = searchSvc.createSearcher(
        mockFieldSpec.fieldList,
        mockEsUrl,
        mockEsParams,
        mockQueryText,
        {},
        'es'
      );
    }));

    it('reports failures', function() {
      var failureResponse = {
        _shards: {
          total:      2,
          successful: 1,
          failed:     1,
          failures: [
            {
              index:  'statedecoded',
              shard:  1,
              status: 400,
              reason: "ElasticsearchIllegalArgumentException[field [cast] isn't a leaf field]"
            }
          ]
        },
        hits: {
          total: 2,
          'max_score': 1.0,
          hits: []
        }
      };
      $httpBackend.expectPOST(mockEsUrl).
      respond(200, failureResponse);

      var errorCalled = 0;

      searcher.search()
      .then(function success() {
        errorCalled--;
      }, function failure(msg) {
        expect(msg.reason).toBe("ElasticsearchIllegalArgumentException[field [cast] isn't a leaf field]");
        errorCalled++;
      });

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(errorCalled).toEqual(1);
    });
  });
});

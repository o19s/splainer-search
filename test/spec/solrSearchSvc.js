'use strict';
/* global urlContainsParams, urlMissingParams, mockExplainOther*/
/*global describe,beforeEach,inject,it,expect*/
describe('Service: searchSvc: Solr', function () {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  // instantiate service
  var searchSvc;
  var activeQueries;
  var $httpBackend = null;
  var fieldSpecSvc = null;
  var mockSolrUrl = 'http://example.com:1234/solr/select';
  var mockSolrParams = {
    q: ['#$query##'],
    fq: ['field:value', 'field1:value', 'field2:#$query##']
  };
  var expectedParams = angular.copy(mockSolrParams);
  var mockQueryText = 'query text';
  var mockFieldSpec = null;
  expectedParams.q[0] =   encodeURIComponent(mockQueryText);
  expectedParams.fq[2] = 'field2:' + encodeURIComponent(mockQueryText);
  var mockResults = {
    response: {
      numFound: 2,
      docs : [
        {id: 'doc1'}, {id: 'doc2'}
      ]
    }
  };

  beforeEach(inject(function($injector) {
    $httpBackend = $injector.get('$httpBackend');
  }));

  beforeEach(inject(function (_searchSvc_, _fieldSpecSvc_, _activeQueries_) {
    searchSvc     = _searchSvc_;
    fieldSpecSvc  = _fieldSpecSvc_;
    activeQueries = _activeQueries_;
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1');

    activeQueries.count = 0;
  }));

  it('access solr with mock solr params', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec.fieldList(), mockSolrUrl,
                                                mockSolrParams, mockQueryText);
    $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                            .respond(200, mockResults);
    searcher.search();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('tracks active queries', function() {
    expect(searchSvc.activeQueries()).toEqual(0);
    var searcher = searchSvc.createSearcher(mockFieldSpec.fieldList(), mockSolrUrl,
                                                mockSolrParams, mockQueryText);
    $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                            .respond(200, mockResults);
    searcher.search();
    expect(searchSvc.activeQueries()).toEqual(1);
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    expect(searchSvc.activeQueries()).toEqual(0);
  });

  describe('highlights', function() {
    var fullSolrResp = {'responseHeader':{
      'status':0,
      'QTime':1,
      'params':{
          'df':'content',
          'echoParams':'all',
          'rows':'2',
          'debugQuery':'true',
          'fl':'path content',
          'indent':['true',
            'true'],
          'q':'*:*',
          'wt':'json',
        }
      },
      'response':{'numFound':100,'start':0,'docs':[
          {
            'content':'stuff',
            'path':'http://larkin.com/index/'
          },
          {
            'content':'more stuff',
            'path':'http://www.rogahnbins.com/main.html'
          }
        ]
      }
    };

    // optional highlighting part
    var highlighting = null;

    var searcher = null;

    var createSearcherHlOn = function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      searcher = searchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
    };

    var createSearcherHlOff = function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      var noHlConfig = searchSvc.configFromDefault();
      noHlConfig.highlight = false;
      searcher = searchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText,
                                                  noHlConfig);
    };

    var expectedHlParams = null;

    beforeEach(function() {
      highlighting ={
        'http://larkin.com/index/': {
          content: searchSvc.HIGHLIGHTING_PRE + 'highlighted larkin' + searchSvc.HIGHLIGHTING_POST,
          contentHlBold: '<b>highlighted larkin</b>'
        },
        'http://www.rogahnbins.com/main.html': {
          content: searchSvc.HIGHLIGHTING_PRE + 'highlighted rogah' + searchSvc.HIGHLIGHTING_POST,
          contentHlBold: '<b>highlighted rogah</b>'
        }
      };


      expectedHlParams = {'hl': ['true'],
                          'hl.simple.pre': [searchSvc.HIGHLIGHTING_PRE],
                          'hl.simple.post': [searchSvc.HIGHLIGHTING_POST],
                          'hl.fl': ['path content']};
    });

    it('asks for highlights', function() {
      createSearcherHlOn();
      var copiedResp = angular.copy(fullSolrResp);
      copiedResp.highlighting = highlighting;

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedHlParams))
                              .respond(200, copiedResp);
      var called = 0;
      searcher.search().then(function() {
        called++;
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);

    });

    it('gets highlight snippet field values if returned', function() {
      createSearcherHlOn();
      var copiedResp = angular.copy(fullSolrResp);
      copiedResp.highlighting = highlighting;
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, copiedResp);
      var called = 0;
      searcher.search().then(function() {
        called++;
        var solrDocs = searcher.docs;
        var docId = fullSolrResp.response.docs[0].path;
        var expectedSnip = highlighting[docId].content;
        var expectedHl = highlighting[docId].contentHlBold;
        expect(solrDocs[0].snippet(docId, 'content')).toEqual(expectedSnip);
        expect(solrDocs[0].highlight(docId, 'content', '<b>', '</b>')).toEqual(expectedHl);

        docId = fullSolrResp.response.docs[1].path;
        expectedSnip = highlighting[docId].content;
        expectedHl = highlighting[docId].contentHlBold;
        expect(solrDocs[1].snippet(docId, 'content')).toEqual(expectedSnip);
        expect(solrDocs[1].highlight(docId, 'content', '<b>', '</b>')).toEqual(expectedHl);
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('gets null if no highlights for field', function() {
      createSearcherHlOn();
      var copiedResp = angular.copy(fullSolrResp);
      copiedResp.highlighting = highlighting;
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, copiedResp);
      var called = 0;
      searcher.search().then(function() {
        called++;
        var solrDocs = searcher.docs;
        var docId = fullSolrResp.response.docs[0].path;
        var expectedSnip = null;
        var expectedHl = null;
        expect(solrDocs[0].snippet(docId, 'some_other_field')).toEqual(expectedSnip);
        expect(solrDocs[0].highlight(docId, 'some_other_field', '<b>', '</b>')).toEqual(expectedHl);
        docId = fullSolrResp.response.docs[1].path;
        expectedSnip = null;
        expectedHl = null;
        expect(solrDocs[1].snippet(docId, 'yet_another_field')).toEqual(expectedSnip);
        expect(solrDocs[1].highlight(docId, 'yet_another_field', '<b>', '</b>')).toEqual(expectedHl);
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('gets null if no highlights', function() {
      createSearcherHlOn();
      var copiedResp = angular.copy(fullSolrResp);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, copiedResp);
      var called = 0;
      searcher.search().then(function() {
        called++;
        var solrDocs = searcher.docs;
        var docId = fullSolrResp.response.docs[0].path;
        var expectedSnip = null;
        var expectedHl = null;
        expect(solrDocs[0].snippet(docId, 'content')).toEqual(expectedSnip);
        expect(solrDocs[0].highlight(docId, 'content', '<b>', '</b>')).toEqual(expectedHl);
        docId = fullSolrResp.response.docs[1].path;
        expectedSnip = null;
        expectedHl = null;
        expect(solrDocs[1].snippet(docId, 'content')).toEqual(expectedSnip);
        expect(solrDocs[1].highlight(docId, 'content', '<b>', '</b>')).toEqual(expectedHl);
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('doesnt request hls if hls off', function() {
      createSearcherHlOff();
      var copiedResp = angular.copy(fullSolrResp);
      $httpBackend.expectJSONP(urlMissingParams(mockSolrUrl, expectedHlParams))
                              .respond(200, copiedResp);
      var called = 0;
      searcher.search().then(function() {
        called++;
        var solrDocs = searcher.docs;
        var docId = fullSolrResp.response.docs[0].path;
        var expectedSnip = null;
        var expectedHl = null;
        expect(solrDocs[0].snippet(docId, 'content')).toEqual(expectedSnip);
        expect(solrDocs[0].highlight(docId, 'content', '<b>', '</b>')).toEqual(expectedHl);
        docId = fullSolrResp.response.docs[1].path;
        expectedSnip = null;
        expectedHl = null;
        expect(solrDocs[1].snippet(docId, 'content')).toEqual(expectedSnip);
        expect(solrDocs[0].highlight(docId, 'content', '<b>', '</b>')).toEqual(expectedHl);
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

  });

  describe('explain info ', function() {
    var fullSolrResp = {'responseHeader':{
      'status':0,
      'QTime':1,
      'params':{
          'df':'content',
          'echoParams':'all',
          'rows':'2',
          'debugQuery':'true',
          'fl':'path content',
          'indent':['true',
            'true'],
          'q':'*:*',
          'wt':'json',
        }
      },
      'response':{'numFound':100,'start':0,'docs':[
          {
            'content':'stuff',
            'path':'http://larkin.com/index/'
          },
          {
            'content':'more stuff',
            'path':'http://www.rogahnbins.com/main.html'
          }
        ]
      },
      'debug':{
          'rawquerystring':'*:*',
          'querystring':'*:*',
          'parsedquery':'MatchAllDocsQuery(*:*)',
          'parsedquery_toString':'*:*',
          'explain':{
            'http://larkin.com/index/':'\n1.0 = (MATCH) MatchAllDocsQuery, product of:\n  1.0 = queryNorm\n',
            'http://www.rogahnbins.com/main.html':'\n1.0 = (MATCH) MatchAllDucksQuery, product of:\n  1.0 = queryNorm\n'
          },
          'explainOther': {
            'http://snarkin.com/index/': mockExplainOther.l514,
            'http://ploppers.com/main.html':mockExplainOther.l71
          },
          'QParser':'LuceneQParser',
          'timing':{
            'time':1.0,
            'prepare':{
              'time':1.0,
              'query':{
                'time':0.0
              },
              'facet':{
                'time':0.0
              },
              'mlt':{
                'time':0.0
              },
              'highlight':{
                'time':0.0
              },
              'stats':{
                'time':0.0
              },
              'debug':{
                'time':0.0
              }
            },
            'process':{
              'time':0.0,
              'query':{
                'time':0.0
              },
              'facet':{
                'time':0.0
              },
              'mlt':{
                'time':0.0
              },
              'highlight':{
                'time':0.0
              },
              'stats':{
                'time':0.0
              },
              'debug':{
                'time':0.0
              }
            }
          }
        }
    };
    var fieldSpec = null;
    var searcher = null;
    var expectedDebugParams = null;

    beforeEach(function() {
      expectedDebugParams = {'debug': ['true'],
                             'debug.explain.structured': ['true']};
    });

    var createSearcherWithDebug = function() {
      fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      searcher = searchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
    };

    var createSearcherDebugOff = function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      var noHlConfig = searchSvc.configFromDefault();
      noHlConfig.debug = false;
      searcher = searchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText,
                                                  noHlConfig);
    };

    it('populates explain()', function() {
      createSearcherWithDebug();
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
                              .respond(200, fullSolrResp);
      searcher.search().then(function() {
        var solrDocs = searcher.docs;
        expect(solrDocs[0].explain('http://larkin.com/index/')).toEqual('\n1.0 = (MATCH) MatchAllDocsQuery, product of:\n  1.0 = queryNorm\n');
        expect(solrDocs[1].explain('http://www.rogahnbins.com/main.html')).toEqual('\n1.0 = (MATCH) MatchAllDucksQuery, product of:\n  1.0 = queryNorm\n');
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('populates others explained', function() {
      createSearcherWithDebug();
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
                              .respond(200, fullSolrResp);
      var called = 0;
      searcher.search().then(function() {
        called++;
        var othersExplained = searcher.othersExplained;
        expect(Object.keys(othersExplained).length).toBe(2);
        expect(othersExplained.hasOwnProperty('http://snarkin.com/index/')).toBeTruthy();
        expect(othersExplained['http://snarkin.com/index/']).toEqual(mockExplainOther.l514);
        expect(othersExplained.hasOwnProperty('http://ploppers.com/main.html')).toBeTruthy();
        expect(othersExplained['http://ploppers.com/main.html']).toEqual(mockExplainOther.l71);
      });
      $httpBackend.flush();
      expect(called).toBe(1);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('returns null on no explain', function() {
      createSearcherWithDebug();
      var copiedResp = angular.copy(fullSolrResp);
      delete copiedResp.debug;
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, copiedResp);
      searcher.search().then(function() {
        var solrDocs = searcher.docs;
        expect(solrDocs[0].explain('http://larkin.com/index/')).toBe(null);
        expect(solrDocs[1].explain('http://www.rogahnbins.com/main.html')).toBe(null);
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });


    it('doesnt request debug info when configured not to', function() {
      createSearcherDebugOff();
      var copiedResp = angular.copy(fullSolrResp);
      delete copiedResp.debug;
      $httpBackend.expectJSONP(urlMissingParams(mockSolrUrl, expectedDebugParams))
                              .respond(200, copiedResp);
      searcher.search().then(function() {
        var solrDocs = searcher.docs;
        expect(solrDocs[0].explain('http://larkin.com/index/')).toBe(null);
        expect(solrDocs[1].explain('http://www.rogahnbins.com/main.html')).toBe(null);
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });
  });

  // For tests where 'id' is not the id field
  describe('alt id field tests', function() {
    var mockResultsAltId = {
      response: {
        numFound: 2,
        docs : [
          {altId: 'alt_doc1'}, {altId: 'alt_doc2'}
        ]
      }
    };

    var fieldSpec = null;
    var searcher = null;
    beforeEach(function() {
      fieldSpec = fieldSpecSvc.createFieldSpec('id:altId');
      searcher = searchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
    });

    it('works with an alternate id field', function() {
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResultsAltId);
      searcher.search().then(function() {
        var numDocs = searcher.numFound;
        var solrDocs = searcher.docs;
        expect(solrDocs.length).toEqual(2);
        expect(numDocs).toEqual(2);
        // sanity check on these docs
        angular.forEach(solrDocs, function(queryDoc) {
          expect(['alt_doc1', 'alt_doc2']).toContain(queryDoc.altId);
        });
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('creates docs that can construct tokens URL', function() {
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResultsAltId);
      searcher.search().then(function() {
        var numDocs = searcher.numFound;
        var solrDocs = searcher.docs;
        expect(solrDocs.length).toEqual(2);
        expect(numDocs).toEqual(2);
        // sanity check on these docs
        angular.forEach(solrDocs, function(queryDoc) {
          var generatedUrl = queryDoc.url('altId', queryDoc.altId);
          expect(generatedUrl.indexOf('q=altId:' + queryDoc.altId)).not.toBe(-1);
        });
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();

    });

    it('escapes percents in the query', function() {
      var mockSolrParamsWithMm = angular.copy(mockSolrParams);
      mockSolrParamsWithMm.mm = ['100%'];
      var expectedParamsMm = angular.copy(expectedParams);
      mockSolrParamsWithMm.mm = ['100%25'];
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:altId');
      var searcher = searchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParamsWithMm, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParamsMm))
                              .respond(200, mockResultsAltId);
      searcher.search();
      $httpBackend.verifyNoOutstandingExpectation();

    });
  });

  describe('encode URL', function() {
    it('encodes the url characters', function() {
      var s = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
      var e = '%20!%22%23%24%25%26\'()*%2B%2C-.%2F0123456789%3A%3B%3C%3D%3E%3F%40ABCDEFGHIJKLMNOPQRSTUVWXYZ%5B%5C%5D%5E_%60abcdefghijklmnopqrstuvwxyz%7B%7C%7D~';
      expect(e).toEqual(encodeURIComponent(s));
    });
  });

  describe('search' ,function() {
    it('makes querydocs with tokensUrl', function() {
      var searcher = searchSvc.createSearcher(mockFieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search().then(function() {
        var solrDocs = searcher.docs;
        var expectedFacetField = {
          'facet.field': ['field1', 'field']
        };
        angular.forEach(solrDocs, function(doc) {
          expect(urlContainsParams(mockSolrUrl, expectedFacetField).test(doc.url('id', '12'))).toBeTruthy();
        });
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('escapes ids passed into url', function() {
      var searcher = searchSvc.createSearcher(mockFieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search().then(function() {
        var solrDocs = searcher.docs;
        angular.forEach(solrDocs, function(doc) {
          var tokenUrl = doc.url('id', 'http://12');
          expect(tokenUrl.indexOf('http://12')).toBe(-1);
          var encId = encodeURIComponent('http\\://12');
          expect(tokenUrl.indexOf(encId)).not.toBe(-1);
        });
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('doesnt include score in facetfield', function() {
      var fieldSpecWithScore = fieldSpecSvc.createFieldSpec('field field1 score');
      var searcher = searchSvc.createSearcher(fieldSpecWithScore.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search().then(function() {
        var solrDocs = searcher.docs;
        var expectedFacetField = {
          'facet.field': ['field1', 'field']
        };
        angular.forEach(solrDocs, function(doc) {
          expect(urlContainsParams(mockSolrUrl, expectedFacetField).test(doc.url('id', 'foo'))).toBeTruthy();
          expect(doc.url('id', 'foo').match(/facet.field=score/)).toBeFalsy();
        });
      });

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('linkurl has wt=xml', function() {
      var fieldSpecWithScore = fieldSpecSvc.createFieldSpec('field field1 score');
      var searcher = searchSvc.createSearcher(fieldSpecWithScore.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      expect(searcher.linkUrl.indexOf('wt=xml')).not.toBe(-1);
    });

    it('sanitizes solr arguments', function() {
      var fieldSpecWithScore = fieldSpecSvc.createFieldSpec('field field1 score');
      var mockUncleanSolrParams = angular.copy(mockSolrParams);
      // make it filthy with these params we need to strip out!
      mockUncleanSolrParams.wt = ['xml'];
      mockUncleanSolrParams.rows = ['20'];
      mockUncleanSolrParams.debug = ['true'];
      var searcher = searchSvc.createSearcher(
        fieldSpecWithScore.fieldList(),
        mockSolrUrl,
        mockUncleanSolrParams,
        mockQueryText
      );
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('doesnt sanitize solr arguments when told not to', function() {
      var fieldSpecWithScore = fieldSpecSvc.createFieldSpec('field field1 score');
      var mockUncleanSolrParams = {};
      // make it filthy with these params we need to strip out!
      mockUncleanSolrParams.rows = ['20'];
      var searcher = searchSvc.createSearcher(
        fieldSpecWithScore.fieldList(),
        mockSolrUrl,
        mockUncleanSolrParams,
        mockQueryText,
        { sanitize: false }
      );
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, mockUncleanSolrParams))
                              .respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('searches with fl == *', function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('*');
      var searcher = searchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
                                                  {'q': ['*:*']}, mockQueryText);
      var testSolrParams = {'fl': ['*']};
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, testSolrParams))
                              .respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('escape special chars in queryText', function() {
      var thisExpectedParams    = angular.copy(expectedParams);
      var queryWithSpecialChars = '+-!(){}[]^"~*?:\\';
      var escapedQuery          = '\\+\\-\\!\\(\\)\\{\\}\\[\\]\\^\\\"\\~\\*\\?\\:\\\\';
      thisExpectedParams.q[0]   = encodeURIComponent(escapedQuery);
      thisExpectedParams.fq[2]  = 'field2:' + encodeURIComponent(escapedQuery);

      var searcher = searchSvc.createSearcher(
        mockFieldSpec.fieldList(),
        mockSolrUrl,
        mockSolrParams,
        queryWithSpecialChars
      );

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, thisExpectedParams))
        .respond(200, mockResults);

      searcher.search();

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });
  });


  describe('group-by', function() {
    var groupedSolrResp = { responseHeader:{
          'status':0,
          'QTime':3},
        'grouped':{
          'catch_line':{
            'matches':20148,
            'groups':[{
                'groupValue':'would',
                'doclist':{'numFound':547,'start':0,'docs':[
                    {
                      'id':'l_510',
                      'catch_line':'doug put this here'}]
                }}]},
          'text':{
            'matches':20148,
            'groups':[{
                'groupValue':'would',
                'doclist':{'numFound':547,'start':0,'docs':[
                    {
                      'id':'l_11730',
                      'catch_line':'Definitions.'},
                    {
                      'id':'l_22002',
                      'catch_line':'(Effective until October 1, 2012) Frequency of inspection; scope of inspection.'},
                    {
                      'id':'l_3845',
                      'catch_line':'Alternate procedure for sale of real estate of person under disability.'}]
                }},
              {
                'groupValue':'within',
                'doclist':{'numFound':1471,'start':0,'docs':[
                    {
                      'id':'l_5780',
                      'catch_line':'Approved plan required for issuance of grading, building, or other permits; security for performance.'},
                    {
                      'id':'l_16271',
                      'catch_line':'Consultation with health regulatory boards.'},
                    {
                      'id':'l_20837',
                      'catch_line':'Powers, duties and responsibilities of the Inspector.'}]
                }}]}},
        'highlighting':{
          'l_11730':{},
          'l_22002':{},
          'l_3845':{},
          'l_5780':{},
          'l_16271':{},
          'l_20837':{}},
        'debug':{
          'rawquerystring':'*:*',
          'querystring':'*:*',
          'parsedquery':'MatchAllDocsQuery(*:*)',
          'parsedquery_toString':'*:*',
          'explain':{
            'l_11730':{
              'match':true,
              'value':1.0,
              'description':'MatchAllDocsQuery, product of:',
              'details':[{
                  'match':true,
                  'value':1.0,
                  'description':'queryNorm'}]},
            'l_22002':{
              'match':true,
              'value':1.0,
              'description':'MatchAllDocsQuery, product of:',
              'details':[{
                  'match':true,
                  'value':1.0,
                  'description':'queryNorm'}]},
            'l_3845':{
              'match':true,
              'value':1.0,
              'description':'MatchAllDocsQuery, product of:',
              'details':[{
                  'match':true,
                  'value':1.0,
                  'description':'queryNorm'}]},
            'l_5780':{
              'match':true,
              'value':1.0,
              'description':'MatchAllDocsQuery, product of:',
              'details':[{
                  'match':true,
                  'value':1.0,
                  'description':'queryNorm'}]},
            'l_16271':{
              'match':true,
              'value':1.0,
              'description':'MatchAllDocsQuery, product of:',
              'details':[{
                  'match':true,
                  'value':1.0,
                  'description':'queryNorm'}]},
            'l_20837':{
              'match':true,
              'value':1.0,
              'description':'MatchAllDocsQuery, product of:',
              'details':[{
                  'match':true,
                  'value':1.0,
                  'description':'queryNorm'}]}},
          'QParser':'LuceneQParser',
          'timing':{
            'time':3.0,
            'prepare':{
              'time':0.0,
              'query':{
                'time':0.0},
              'facet':{
                'time':0.0},
              'mlt':{
                'time':0.0},
              'highlight':{
                'time':0.0},
              'stats':{
                'time':0.0},
              'expand':{
                'time':0.0},
              'debug':{
                'time':0.0}},
            'process':{
              'time':3.0,
              'query':{
                'time':1.0},
              'facet':{
                'time':0.0},
              'mlt':{
                'time':0.0},
              'highlight':{
                'time':2.0},
              'stats':{
                'time':0.0},
              'expand':{
                'time':0.0},
              'debug':{
                'time':0.0}}}}};

    var fieldSpec = null;
    var searcher = null;

    beforeEach(function() {
      fieldSpec = fieldSpecSvc.createFieldSpec('id catch_line');
      searcher = searchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
                                              mockSolrParams, mockQueryText);
    });

    it('parses a grouped response', function() {
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, groupedSolrResp);
      var called = 0;
      searcher.search()
      .then(function() {
        expect(searcher.docs.length).toEqual(7);
        expect(searcher.grouped.hasOwnProperty('text')).toBeTruthy();
        expect(searcher.grouped.hasOwnProperty('catch_line')).toBeTruthy();
        var gpd = searcher.grouped;
        expect(gpd.text[0].value).toEqual('would');
        expect(gpd.text[0].docs.length).toEqual(3);
        expect(gpd.text[0].docs[0].source().id).toEqual('l_11730');
        expect(gpd.text[0].docs[0].group()).toEqual('would');
        expect(gpd.text[0].docs[1].source().id).toEqual('l_22002');
        expect(gpd.text[0].docs[1].group()).toEqual('would');
        expect(gpd.text[0].docs[2].source().id).toEqual('l_3845');
        expect(gpd.text[0].docs[2].group()).toEqual('would');
        angular.forEach(gpd.text[0].docs, function(doc) {
          expect(doc.group()).toEqual('would');
          expect(doc.groupedBy()).toEqual('text');
        });

        expect(gpd.text[1].value).toEqual('within');
        expect(gpd.text[1].docs.length).toEqual(3);
        expect(gpd.text[1].docs[0].source().id).toEqual('l_5780');
        expect(gpd.text[1].docs[1].source().id).toEqual('l_16271');
        expect(gpd.text[1].docs[2].source().id).toEqual('l_20837');
        angular.forEach(gpd.text[1].docs, function(doc) {
          expect(doc.group()).toEqual('within');
          expect(doc.groupedBy()).toEqual('text');
        });

        /*jshint camelcase: false */
        angular.forEach(gpd.catch_line[0].docs, function(doc) {
          expect(doc.group()).toEqual('would');
          expect(doc.groupedBy()).toEqual('catch_line');
        });
        called++;
      });
      $httpBackend.flush();
      expect(called).toBe(1);
    });
  });

  describe('vars', function() {
    it('does full replacement', function() {
      var mockQueryText = 'burrito taco';
      var mockSolrParams = {
        q: ['#$query##'],
      };
      var expectedParams = angular.copy(mockSolrParams);
      expectedParams.q[0] = encodeURIComponent(mockQueryText);

      var searcher = searchSvc.createSearcher(mockFieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('does keyword replacement', function() {
      var mockQueryText = 'burrito taco';
      var mockSolrParams = {
        q: ['#$query1## query #$query2##'],
      };
      var expectedParams = angular.copy(mockSolrParams);
      expectedParams.q[0] = 'burrito query taco';

      var searcher = searchSvc.createSearcher(mockFieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('extra keyword replacements go blank', function() {
      var mockQueryText = 'burrito taco';
      var mockSolrParams = {
        q: ['#$query1## query #$query2## nothing #$query3##'],
      };
      var expectedParams = angular.copy(mockSolrParams);
      expectedParams.q[0] = 'burrito query taco nothing ';

      var searcher = searchSvc.createSearcher(mockFieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('super long query', function() {
      var mockQueryText = 'burrito taco nacho bbq turkey donkey michelin stream of consciouness taco bell cannot run away from me crazy muhahahaa peanut';
      var mockSolrParams = {
        q: ['#$query1## query #$query2## nothing #$query3##'],
      };
      var expectedParams = angular.copy(mockSolrParams);
      expectedParams.q[0] = 'burrito query taco nothing nacho';

      var searcher = searchSvc.createSearcher(mockFieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    })
  });

  describe('paging', function() {
    var fullSolrResp = {'responseHeader':{
      'status':0,
      'QTime':1,
      'params':{
          'df':'content',
          'echoParams':'all',
          'rows':'2',
          'debugQuery':'true',
          'fl':'path content',
          'indent':['true',
            'true'],
          'q':'*:*',
          'wt':'json',
        }
      },
      'response':{'numFound':21,'start':0,'docs':[
          {
            'content':'stuff',
            'path':'http://larkin.com/index/'
          },
          {
            'content':'more stuff',
            'path':'http://www.rogahnbins.com/main.html'
          }
        ]
      }};

    var fieldSpec = null;
    var searcher = null;

    beforeEach(function() {
      fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      searcher = searchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
    });

    it('pages on page', function() {
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, fullSolrResp);
      searcher.search();
      $httpBackend.flush();

      // get page 2
      var nextSearcher = searcher.pager();
      var expectedPageParams = angular.copy(expectedParams);
      expectedPageParams.rows = ['10'];
      expectedPageParams.start = ['10'];
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedPageParams))
                              .respond(200, fullSolrResp);
      nextSearcher.search();
      $httpBackend.flush();

      // get page 3
      nextSearcher = nextSearcher.pager();
      expectedPageParams.rows = ['1'];
      expectedPageParams.start =['20'];
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedPageParams))
                              .respond(200, fullSolrResp);
      nextSearcher.search();
      $httpBackend.flush();

      // done
      nextSearcher = nextSearcher.pager();
      expect(nextSearcher).toBe(null);
    });
  });
});

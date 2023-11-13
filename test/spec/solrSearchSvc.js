'use strict';
/* global urlContainsParams, urlMissingParams, mockExplainOther*/
/*global describe,beforeEach,inject,it,expect*/
describe('Service: searchSvc: Solr', function () {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  // instantiate service
  var searchSvc;
  var activeQueries;
  var solrUrlSvc;
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

  beforeEach(inject(function (_searchSvc_, _fieldSpecSvc_, _activeQueries_, _solrUrlSvc_) {
    searchSvc     = _searchSvc_;
    fieldSpecSvc  = _fieldSpecSvc_;
    activeQueries = _activeQueries_;
    solrUrlSvc    = _solrUrlSvc_;
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1 hl:field2');

    activeQueries.count = 0;
  }));

  it('access solr with mock solr params using JSONP', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
                                                mockSolrParams, mockQueryText);
    $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                            .respond(200, mockResults);
    searcher.search();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('access solr with mock solr params using GET', function() {
    // By default we talk to Solr with JSONP because Solr doesn't support cors.  However, if you
    // want your Search API to look like Solr to Quepid, well, you don't need clunky JSONP.
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
                                                mockSolrParams, mockQueryText, { apiMethod: 'GET' });
    $httpBackend.expectGET(urlContainsParams(mockSolrUrl, expectedParams))
                            .respond(200, mockResults);
    searcher.search();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });
  
  it('sets the proper headers for auth', function() {
    var authSolrUrl = 'http://username:password@example.com:1234/solr/select';
    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      authSolrUrl,
      mockSolrParams,
      mockQueryText,
      { apiMethod: 'GET' },
      'solr'
    );

    // The headers need to be removed from the URL, which we accomplish
    // using the esUrlSvc.
     var targetUrl = solrUrlSvc.buildUrl(solrUrlSvc.parseSolrUrl(authSolrUrl))
     $httpBackend.expectGET(targetUrl, undefined, function(headers) {
       return headers['Authorization'] == 'Basic ' + btoa('username:password');
     }).
     respond(200, mockResults);
  });



  it('tracks active queries', function() {
    expect(searchSvc.activeQueries()).toEqual(0);
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
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
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:hl:path hl:content');
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
    };

    var createSearcherHlOff = function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      var noHlConfig = searchSvc.configFromDefault();
      noHlConfig.highlight = false;
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl,
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
            'time':11.0,
            'prepare':{
              'time':1.0,
              'query':{
                'time':1.0
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
              'time':6.0,
              'query':{
                'time':3.0
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
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
    };

    var createSearcherDebugOff = function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      var noDebugConfig = searchSvc.configFromDefault();
      noDebugConfig.debug = false;
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl,
                                                  mockSolrParams, mockQueryText,
                                                  noDebugConfig);
    };

    var mockQuerqyInfolog = {
      'common_rules': [
        {
          'APPLIED_RULES': [
            "92e016b6-c2ad-4672-bb93-73791d94d6ca"
          ]
        }
      ]
    };

    var mockQuerqyDecorations = ["REDIRECT https://www.example.org/"];

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

    it('populates parsed query details', function() {
      createSearcherWithDebug();
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
                              .respond(200, fullSolrResp);
      var called = 0;
      searcher.search().then(function() {
        called++;
        var parsedQueryDetails = searcher.parsedQueryDetails;
        expect(Object.keys(parsedQueryDetails).length).toBe(5);
        expect(parsedQueryDetails['rawquerystring']).toEqual('*:*');
        expect(parsedQueryDetails['querystring']).toEqual('*:*');
        expect(parsedQueryDetails['parsedquery']).toEqual('MatchAllDocsQuery(*:*)');
        expect(parsedQueryDetails['parsedquery_toString']).toEqual('*:*');
        expect(parsedQueryDetails['QParser']).toEqual('LuceneQParser');
      });
      $httpBackend.flush();
      expect(called).toBe(1);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('identifies querqy.infoLogging presence and adds to parsedQueryDetails', function() {
      createSearcherWithDebug();

      var mockSolrResultsWithQuerqyInfolog = angular.copy(fullSolrResp);
      mockSolrResultsWithQuerqyInfolog['querqy.infoLog']= mockQuerqyInfolog;

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
                              .respond(200, mockSolrResultsWithQuerqyInfolog);
      var called = 0;
      searcher.search().then(function() {
        called++;
        var parsedQueryDetails = searcher.parsedQueryDetails;
        expect(Object.keys(parsedQueryDetails).length).toBe(6);
        expect(parsedQueryDetails['rawquerystring']).toEqual('*:*');
        expect(parsedQueryDetails['querqy.infoLog']).toEqual(mockQuerqyInfolog);
      });
      $httpBackend.flush();
      expect(called).toBe(1);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('identifies querqy_decorations presence and adds to parsedQueryDetails', function() {
      createSearcherWithDebug();

      var mockSolrResultsWithQuerqyDecorations = angular.copy(fullSolrResp);
      mockSolrResultsWithQuerqyDecorations['querqy_decorations']= mockQuerqyDecorations;

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
                              .respond(200, mockSolrResultsWithQuerqyDecorations);
      var called = 0;
      searcher.search().then(function() {
        called++;
        var parsedQueryDetails = searcher.parsedQueryDetails;
        expect(Object.keys(parsedQueryDetails).length).toBe(6);
        expect(parsedQueryDetails['rawquerystring']).toEqual('*:*');
        expect(parsedQueryDetails['querqy_decorations']).toEqual(mockQuerqyDecorations);
      });
      $httpBackend.flush();
      expect(called).toBe(1);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('populates raw query details', function() {
      createSearcherWithDebug();
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
                              .respond(200, fullSolrResp);
      var called = 0;
      searcher.search().then(function() {
        called++;
        var queryDetails = searcher.queryDetails;
        expect(Object.keys(queryDetails).length).toBe(8);
        expect(queryDetails['df']).toEqual('content');
        expect(queryDetails['indent']).toEqual(['true','true']);
      });
      $httpBackend.flush();
      expect(called).toBe(1);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('populates query timing details', function() {
      createSearcherWithDebug();
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
                              .respond(200, fullSolrResp);
      var called = 0;
      searcher.search().then(function() {
        called++;
        var timingDetails = searcher.timingDetails;

        expect(Object.keys(timingDetails.events).length).toBe(12);
        expect(timingDetails.events[6].name).toEqual('process_query');
        expect(timingDetails.events[6].duration).toEqual(3);
      });
      $httpBackend.flush();
      expect(called).toBe(1);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('returns empty hash on no params', function() {
      createSearcherWithDebug();
      var copiedResp = angular.copy(fullSolrResp);
      delete copiedResp.responseHeader;
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
                              .respond(200, copiedResp);
      var called = 0;
      searcher.search().then(function() {
        called++;
        expect(searcher.queryDetails).toEqual({});

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

    it('handles parsing the debug json when debug is set to null versus empty array', function() {
      createSearcherWithDebug();
      var copiedResp = angular.copy(fullSolrResp);
      copiedResp.debug = null;
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
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl,
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
          var generatedUrl = queryDoc._url('altId', queryDoc.altId);
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
      var searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl,
                                                  mockSolrParamsWithMm, mockQueryText);
      $httpBackend.expectJSONP(
        urlContainsParams(mockSolrUrl, expectedParamsMm)
      ).respond(200, mockResultsAltId);

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
    it('passes the rows param and sets it to 10 by default', function() {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockSolrUrl,
        mockSolrParams,
        mockQueryText
      );

      var expectedSearchParams = angular.copy(expectedParams);
      expectedSearchParams.rows = ['10'];

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedSearchParams))
        .respond(200, mockResults);

      var called = 0;
      searcher.search().then(function() {
        called++;
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('passes the rows param and sets it to what is passed in the config', function() {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockSolrUrl,
        mockSolrParams,
        mockQueryText,
        { numberOfRows: 30 }
      );

      var expectedSearchParams = angular.copy(expectedParams);
      expectedSearchParams.rows = ['30'];

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedSearchParams))
        .respond(200, mockResults);

      var called = 0;
      searcher.search().then(function() {
        called++;
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('makes querydocs with document url with NO facet', function() {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockSolrUrl,
        mockSolrParams,
        mockQueryText
      );

      $httpBackend.expectJSONP(
        urlContainsParams(mockSolrUrl, expectedParams)
       ).respond(200, mockResults);

      searcher.search().then(function() {
        var solrDocs = searcher.docs;

        // To confirm that we no longer construct a _url with facet parameters.
        var expectedFacetField = {
          'facet.field': ['field1', 'field']
        };
        angular.forEach(solrDocs, function(doc) {
          expect(urlContainsParams(mockSolrUrl, expectedFacetField).test(doc._url('id', '12'))).toBeFalsy();

          expect(doc._url('id', '12').indexOf('wt=json')).not.toBe(-1);
        });
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('escapes ids passed into url', function() {
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search().then(function() {
        var solrDocs = searcher.docs;
        angular.forEach(solrDocs, function(doc) {
          var tokenUrl = doc._url('id', 'http://12');
          expect(tokenUrl.indexOf('http://12')).toBe(-1);
          var encId = encodeURIComponent('http\\://12');
          expect(tokenUrl.indexOf(encId)).not.toBe(-1);
        });
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });


    it('linkurl has wt=json', function() {
      var fieldSpecWithScore = fieldSpecSvc.createFieldSpec('field field1 score');
      var searcher = searchSvc.createSearcher(fieldSpecWithScore, mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      expect(searcher.linkUrl.indexOf('wt=json')).not.toBe(-1);
    });

    it('linkurl has wt=json even when specified as wt=xml', function() {
      var fieldSpecWithScore = fieldSpecSvc.createFieldSpec('field field1 score');
      var mockSolrParams = {
        q: ['#$query##'],
        fq: ['field:value', 'field1:value', 'field2:#$query##'],
        wt: 'xml'
      };
      var searcher = searchSvc.createSearcher(fieldSpecWithScore, mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      expect(searcher.linkUrl.indexOf('wt=json')).not.toBe(-1);
    });

    it('sanitizes solr arguments', function() {
      var fieldSpecWithScore = fieldSpecSvc.createFieldSpec('field field1 score');
      var mockUncleanSolrParams = angular.copy(mockSolrParams);
      // make it filthy with these params we need to strip out!
      mockUncleanSolrParams.wt = ['xml'];
      mockUncleanSolrParams.rows = ['20'];
      mockUncleanSolrParams.debug = ['true'];
      var searcher = searchSvc.createSearcher(
        fieldSpecWithScore,
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
        fieldSpecWithScore,
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
      var searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl,
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
        mockFieldSpec,
        mockSolrUrl,
        mockSolrParams,
        queryWithSpecialChars,
        {
          escapeQuery: true,
        }
      );

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, thisExpectedParams))
        .respond(200, mockResults);

      searcher.search();

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });
  });

  describe('group-by', function() {
    var simpleGroupedSolrResponse = {
      "responseHeader": {
        "status": 0,
        "QTime": 17
      },
      "grouped": {
        "BUS_LISTING_ID": {
          "matches": 19,
          "ngroups": 6,
          "doclist": {
            "numFound": 19,
            "start": 0,
            "docs": [{
              "id": "58356",
              "BUS_LISTING_ID": "1"
            }, {
              "id": "86192",
              "BUS_LISTING_ID": "2"
            }, {
              "id": "158752",
              "BUS_LISTING_ID": "3"
            }, {
              "id": "190993",
              "BUS_LISTING_ID": "4"
            }, {
              "id": "156334",
              "BUS_LISTING_ID": "5"
            }, {
              "id": "45291",
              "BUS_LISTING_ID": "6"
            }]
          }
        }
      },
      "facet_counts": {
        "facet_queries": {},
        "facet_fields": {
          "BUS_GROUP_ID": ["222221", 12, "168504", 2, "359033", 2, "832532", 1, "840097", 1, "956094", 1],
          "BUS_LISTING_ID": ["222221", 12, "168504", 2, "359033", 2, "832532", 1, "840097", 1, "956094", 1],
          "BUS_BUSINESS_NAME_FIRSTCHR": ["a", 16, "r", 2, "h", 1],
          "BUS_FEATURES": ["Ads", 3, "Business Hours", 3, "Business Information", 3, "Website", 3],
          "BUS_CITY_EXACT": ["Prince Albert", 13, "Beauval Forks", 2, "Saskatoon", 2, "Humboldt", 1, "Indian Head", 1],
          "BUS_HEADING_CODE": ["000000", 9, "005120", 4, "023200", 4, "018360", 1, "020350", 1],
          "BUS_HEADING_RELATED_CATEGORIES": ["Delicatessens", 8, "Halls &amp; Auditoriums", 8, "Hotel &amp; Motel Equipment &amp; Supplies", 8, "Restaurant Equipment &amp; Supplies", 8, "Hotels", 5, "Caterers", 4, "Chairs Renting", 4, "Chinese Foods", 4, "Coffee Houses", 4, "Dinner Theatres", 4, "Doughnuts", 4, "Fish &amp; Chips", 4, "Food Products", 4, "Food Service Management &amp; Supplies", 4, "Foods Ready To Serve", 4, "Gourmet Shops", 4, "Health Food Products", 4, "Maid Service", 4, "Night Clubs", 4, "Party Planning Service", 4, "Pizza", 4, "Restaurants", 4, "Sandwiches", 4, "Tea Rooms", 4, "Wedding Planning, Supplies &amp; Service", 4, "Hotels &amp; Motels Reservations Out of Town", 1, "Nursing Homes", 1]
        },
        "facet_dates": {},
        "facet_ranges": {},
        "facet_intervals": {},
        "facet_heatmaps": {}
      },
      "highlighting": {
        "58356": {},
        "86192": {},
        "158752": {},
        "190993": {},
        "156334": {},
        "45291": {}
      }
    };

    var groupedSolrResp = {
      responseHeader:{
          'status':0,
          'QTime':3
      },
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
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl,
                                              mockSolrParams, mockQueryText);
    });


    it('parses an simple grouped response', function() {
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, simpleGroupedSolrResponse);
      var called = 0;
      var q = searcher.search().then(function () {
          expect(searcher.docs.length).toEqual(6);
          expect(searcher.grouped.hasOwnProperty('BUS_LISTING_ID')).toBeTruthy();
          var gpd = searcher.grouped;
          expect(gpd['BUS_LISTING_ID'][0].value).toEqual('1');
        });
      $httpBackend.flush();
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
        expect(gpd.text[0].docs[0].origin().id).toEqual('l_11730');
        expect(gpd.text[0].docs[0].group()).toEqual('would');
        expect(gpd.text[0].docs[1].origin().id).toEqual('l_22002');
        expect(gpd.text[0].docs[1].group()).toEqual('would');
        expect(gpd.text[0].docs[2].origin().id).toEqual('l_3845');
        expect(gpd.text[0].docs[2].group()).toEqual('would');
        angular.forEach(gpd.text[0].docs, function(doc) {
          expect(doc.group()).toEqual('would');
          expect(doc.groupedBy()).toEqual('text');
        });

        expect(gpd.text[1].value).toEqual('within');
        expect(gpd.text[1].docs.length).toEqual(3);
        expect(gpd.text[1].docs[0].origin().id).toEqual('l_5780');
        expect(gpd.text[1].docs[1].origin().id).toEqual('l_16271');
        expect(gpd.text[1].docs[2].origin().id).toEqual('l_20837');
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

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
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
        q: ['#$keyword1## query #$keyword2##'],
      };
      var expectedParams = angular.copy(mockSolrParams);
      expectedParams.q[0] = 'burrito query taco';

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('extra keyword replacements turns to empty string', function() {
      var mockQueryText = 'burrito taco';
      var mockSolrParams = {
        q: ['#$keyword1## query #$keyword2## nothing #$keyword3##'],
      };
      var expectedParams = angular.copy(mockSolrParams);
      expectedParams.q[0] = 'burrito query taco nothing ';

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('custom defaults', function() {
      var mockQueryText = 'burrito taco';
      var mockSolrParams = {
        q: ['#$keyword1## query #$keyword2## nothing #$keyword3|someDefault##'],
      };
      var expectedParams = angular.copy(mockSolrParams);
      expectedParams.q[0] = 'burrito query taco nothing someDefault';

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('many custom defaults', function() {
      var mockQueryText = 'burrito taco';
      var mockSolrParams = {
        q: ['#$keyword1## query #$keyword2## nothing #$keyword3|someDefault## #$keyword3|otherDefaults## #$keyword2##'],
      };
      var expectedParams = angular.copy(mockSolrParams);
      expectedParams.q[0] = 'burrito query taco nothing someDefault otherDefaults taco';

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('many custom defaults, others not customized', function() {
      var mockQueryText = 'burrito taco';
      var mockSolrParams = {
        q: ['#$keyword1## query #$keyword2## nothing #$keyword3|someDefault## #$keyword3|otherDefaults## #$keyword3## #$keyword2##'],
      };
      var expectedParams = angular.copy(mockSolrParams);
      expectedParams.q[0] = 'burrito query taco nothing someDefault otherDefaults  taco';

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('super long query', function() {
      var mockQueryText = 'burrito taco nacho bbq turkey donkey michelin stream of consciousness taco bell cannot run away from me crazy muhahahaa peanut';
      var mockSolrParams = {
        q: ['#$keyword1## query #$keyword2## nothing #$keyword3##'],
      };
      var expectedParams = angular.copy(mockSolrParams);
      expectedParams.q[0] = 'burrito query taco nothing nacho';

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, mockResults);
      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('handles all types of vars', function() {
      // Start off with a simple phrase and make sure the replacement
      // gets handled correctly here
      var mockQueryText = 'burrito taco nacho bbq turkey donkey michelin stream of consciousness taco bell cannot run away from me crazy muhahahaa peanut';
      var mockSolrParams = {
        phrase: [
          'bowl:("#$keyword1## #$keyword2##" OR "#$keyword2## #$keyword3##")'
        ],
        q: [
          '_val_:"product($texmexFunc,1)"'
        ],
      };
      var expectedParams = angular.copy(mockSolrParams);
      expectedParams.phrase[0] = 'bowl:("burrito taco" OR "taco nacho")';

      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockSolrUrl,
        mockSolrParams,
        mockQueryText
      );

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, mockResults);

      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();

      // Add more params
      var mockSolrParams = {
        phrase: [
          'bowl:("#$keyword1## #$keyword2##" OR "#$keyword2## #$keyword3##")'
        ],
        keywords: [
          '{!edismax qf="bowl^10 sofritas" tie=1.0}#$query##'
        ],
        texmexFunc: [
          'if(query($phrase),1.5,1)'
        ],
        q: [
          '_val_:"product($texmexFunc,1)"'
        ],
        fq: [
          '{!edismax qf="bowl sofritas"}#$query##'
        ],
      };
      var expectedParams = angular.copy(mockSolrParams);
      expectedParams.phrase[0] = 'bowl:("burrito taco" OR "taco nacho")';
      expectedParams.keywords[0] = '{!edismax qf="bowl^10 sofritas" tie=1.0}' + encodeURIComponent(mockQueryText);
      expectedParams.fq[0] = '{!edismax qf="bowl sofritas"}' + encodeURIComponent(mockQueryText);

      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockSolrUrl,
        mockSolrParams,
        mockQueryText
      );

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, mockResults);

      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();


      // Add the rest of the params
      var mockSolrParams = {
        phrase: [
          'bowl:("#$keyword1## #$keyword2##" OR "#$keyword2## #$keyword3##")'
        ],
        keywords: [
          '{!edismax qf="bowl^10 sofritas" tie=1.0}#$query##'
        ],
        phraseScore: [
          'div(product(sum(##k##,1),query($phrase)),product(query($phrase),##k##))'
        ],
        texmexFunc: [
          'if(query($phrase),1.5,1)'
        ],
        q: [
          '_val_:"product($texmexFunc,1)"'
        ],
        fq: [
          '{!edismax qf="bowl sofritas"}#$query##'
        ],
      };
      var expectedParams = angular.copy(mockSolrParams);
      expectedParams.phrase[0] = 'bowl:("burrito taco" OR "taco nacho")';
      expectedParams.keywords[0] = '{!edismax qf="bowl^10 sofritas" tie=1.0}' + encodeURIComponent(mockQueryText);
      expectedParams.fq[0] = '{!edismax qf="bowl sofritas"}' + encodeURIComponent(mockQueryText);

      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockSolrUrl,
        mockSolrParams,
        mockQueryText
      );

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, mockResults);

      searcher.search();
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });
  });

  describe('errors', function() {
    var fieldSpec = null;
    var searcher = null;

    beforeEach(function() {
      fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
    });

    it('adds searchError text', function() {
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(-1);
      var errorCnt = 0;
      searcher.search().then(function() {
        errorCnt--;
      },
      function error(msg) {
        errorCnt++;
        expect(msg.searchError.length).toBeGreaterThan(1);
      });
      $httpBackend.flush();
      expect(errorCnt).toBe(1);
    });
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
      fieldSpec = fieldSpecSvc.createFieldSpec('id:path hl:content');
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
    });

    it("does not escapes the query if escapeQuery is false", function () {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockSolrUrl,
        mockSolrParams,
        mockQueryText,
        {
          escapeQuery: false,
        }
      );

      // get page 2
      var nextSearcher = searcher.pager();
      expect(nextSearcher.config.escapeQuery).toBeFalse();
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
      expectedPageParams.rows = ['10'];
      expectedPageParams.start =['20'];
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedPageParams))
                              .respond(200, fullSolrResp);
      nextSearcher.search();
      $httpBackend.flush();

      // done
      nextSearcher = nextSearcher.pager();
      expect(nextSearcher).toBe(null);
    });

    it('accounts for custom rows count', function() {
      var solrRespCustRows = angular.copy(fullSolrResp)
      solrRespCustRows.response.numFound = 61;

      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockSolrUrl,
        mockSolrParams,
        mockQueryText,
        { numberOfRows: 30 }
      );

      var expectedPageParams = angular.copy(expectedParams);
      expectedPageParams.rows = ['30'];

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedPageParams))
        .respond(200, solrRespCustRows);

      searcher.search();
      $httpBackend.flush();

      // get page 2
      var nextSearcher = searcher.pager();
      var expectedPageParams = angular.copy(expectedParams);
      expectedPageParams.rows = ['30'];
      expectedPageParams.start = ['30'];

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedPageParams))
        .respond(200, solrRespCustRows);

      nextSearcher.search();
      $httpBackend.flush();

      // get page 3
      nextSearcher = nextSearcher.pager();
      expectedPageParams.rows = ['30'];
      expectedPageParams.start =['60'];

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedPageParams))
        .respond(200, solrRespCustRows);

      nextSearcher.search();
      $httpBackend.flush();

      // done
      nextSearcher = nextSearcher.pager();
      expect(nextSearcher).toBe(null);
    });

    it('highlights new page', function() {
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                  .respond(200, fullSolrResp);
      searcher.search();
      $httpBackend.flush();

      // get page 2
      var nextSearcher        = searcher.pager();
      var expectedPageParams  = angular.copy(expectedParams);

      expectedPageParams.rows       = ['10'];
      expectedPageParams.start      = ['10'];
      expectedPageParams.hl         = ['true'];
      expectedPageParams.hl.simple  = {
        pre:  [searchSvc.HIGHLIGHTING_PRE],
        post: [searchSvc.HIGHLIGHTING_POST],
      };

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedPageParams))
                              .respond(200, fullSolrResp);
      nextSearcher.search();

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });
  });

  describe('explain other', function() {
    var mockSolrResp = {
      response: {
        numFound: 2,
        docs : [
          {id: 'doc1', title: 'title1'},
          {id: 'doc2', title: 'title2'}
        ]
      }
    };

    var explOtherDoc1 = {
      match:       false,
      value:       0.0,
      description: 'no matching term'
    };

    var explOtherDoc2 = {
      match:        true,
      value:        3.3733945,
      description:  'weight(catch_line:law in 4487) [DefaultSimilarity], result of:',
      details: [
        {
          match:        true,
          value:        3.3733945,
          description:  'fieldWeight in 4487, product of:',
          details :[
            {
              match:        true,
              value:        1.0,
              description:  'tf(freq=1.0), with freq of:',
              details:[
                {
                  match:        true,
                  value:        1.0,
                  description:  'termFreq=1.0'
                }
              ]
            },
            {
              match:        true,
              value:        5.3974314,
              description:  'idf(docFreq=247, maxDocs=20148)'
            },
            {
              match:        true,
              value:        0.625,
              description:  'fieldNorm(doc=4487)'
            }
          ]
        }
      ]
    };

    var mockSolrExplOtherResp = {
      response: {
        numFound: 2,
        docs : [
          {id: 'not_doc1', title: 'title1'},
          {id: 'not_doc2', title: 'title2'}
        ]
      },
      debug: {
        explainOther: {
          'doc1': explOtherDoc1,
          'doc2': explOtherDoc2
        }
      }
    };

    it('passes two solr queries one explains the other', function() {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockSolrUrl,
        mockSolrParams,
        mockQueryText
      );

      var expectedParams = {
        q: ['title:doc1']
      };

      var expectedExplOtherParams = {
        explainOther: ['title:doc1']
      };

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedExplOtherParams))
        .respond(200, mockSolrExplOtherResp);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, mockSolrResp);

      searcher.explainOther('title:doc1', mockFieldSpec);

      $httpBackend.flush();

      expect(searcher.docs.length).toBe(2);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('highlights explain other', function() {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockSolrUrl,
        mockSolrParams,
        mockQueryText
      );

      var expectedParams = {
        q: ['title:doc1'],
        hl: ['true'],
        'hl.simple.pre': [searchSvc.HIGHLIGHTING_PRE],
        'hl.simple.post': [searchSvc.HIGHLIGHTING_POST]
      };

      var expectedExplOtherParams = {
        explainOther: ['title:doc1']
      };

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedExplOtherParams))
        .respond(200, mockSolrExplOtherResp);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, mockSolrResp);

      searcher.explainOther('title:doc1', mockFieldSpec);

      $httpBackend.flush();

      expect(searcher.docs.length).toBe(2);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('does not throw an error if both queries are empty', function () {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockSolrUrl,
        mockSolrParams,
        ''
      );

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl))
        .respond(200, mockSolrExplOtherResp);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl))
        .respond(200, mockSolrResp);

      searcher.explainOther('', mockFieldSpec);

      $httpBackend.flush();
      expect(searcher.docs.length).toBe(2);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('paginates for explain other searches', function() {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockSolrUrl,
        mockSolrParams,
        mockQueryText
      );

      searcher.numFound = 100;
      searcher = searcher.pager();

      var expectedParams = {
        q:      ['title:doc1'],
        start:  ['10'],
        rows:   ['10']
      };

      var expectedExplOtherParams = {
        explainOther: ['title:doc1']
      };

      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedExplOtherParams))
        .respond(200, mockSolrExplOtherResp);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, mockSolrResp);

      searcher.explainOther('title:doc1', mockFieldSpec);

      $httpBackend.flush();

      expect(searcher.docs.length).toBe(2);
      $httpBackend.verifyNoOutstandingExpectation();
    });
  });
});

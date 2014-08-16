'use strict';
/* global urlContainsParams*/
/*global describe,beforeEach,inject,it,expect*/
describe('Service: solrSearchSvc', function () {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  // instantiate service
  var solrSearchSvc;
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
  
  beforeEach(inject(function (_solrSearchSvc_, _fieldSpecSvc_) {
    solrSearchSvc = _solrSearchSvc_;
    fieldSpecSvc = _fieldSpecSvc_;
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1');
  }));
  
  it('access solr with mock solr params', function() {
    var searcher = solrSearchSvc.createSearcher(mockFieldSpec.fieldList(), mockSolrUrl,
                                                mockSolrParams, mockQueryText);
    $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                            .respond(200, mockResults);
    searcher.search();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('tracks active queries', function() {
    expect(solrSearchSvc.activeQueries()).toEqual(0);
    var searcher = solrSearchSvc.createSearcher(mockFieldSpec.fieldList(), mockSolrUrl,
                                                mockSolrParams, mockQueryText);
    $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                            .respond(200, mockResults);
    searcher.search();
    expect(solrSearchSvc.activeQueries()).toEqual(1);
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    expect(solrSearchSvc.activeQueries()).toEqual(0);
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
    var highlighting = {
      'http://larkin.com/index/': {
        content: 'highlighted larkin'
      },
      'http://www.rogahnbins.com/main.html': {
        content: 'highlighted rogah'
      }
    };

    var searcher = null;

    beforeEach(function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      searcher = solrSearchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
    });
    
    it('asks for highlights', function() {
      var copiedResp = angular.copy(fullSolrResp);
      copiedResp.highlighting = highlighting;

      var expectedHlParams = {'hl': ['true'],
                              'hl.simple.pre': [solrSearchSvc.HIGHLIGHTING_PRE],
                              'hl.simple.post': [solrSearchSvc.HIGHLIGHTING_POST]};

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
    
    it('gets highlight field values if returned', function() {
      var copiedResp = angular.copy(fullSolrResp);
      copiedResp.highlighting = highlighting;
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, copiedResp);
      var called = 0;
      searcher.search().then(function() {
        called++;
        var solrDocs = searcher.docs;
        var docId = fullSolrResp.response.docs[0].path;
        var expectedHl = highlighting[docId].content;
        expect(solrDocs[0].highlight(docId, 'content')).toEqual(expectedHl);
        docId = fullSolrResp.response.docs[1].path;
        expectedHl = highlighting[docId].content;
        expect(solrDocs[1].highlight(docId, 'content')).toEqual(expectedHl);
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });
    
    it('gets null if no highlights for field', function() {
      var copiedResp = angular.copy(fullSolrResp);
      copiedResp.highlighting = highlighting;
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, copiedResp);
      var called = 0;
      searcher.search().then(function() {
        called++;
        var solrDocs = searcher.docs;
        var docId = fullSolrResp.response.docs[0].path;
        var expectedHl = null;
        expect(solrDocs[0].highlight(docId, 'some_other_field')).toEqual(expectedHl);
        docId = fullSolrResp.response.docs[1].path;
        expectedHl = null;
        expect(solrDocs[1].highlight(docId, 'yet_another_field')).toEqual(expectedHl);
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });
    
    it('gets null if no highlights', function() {
      var copiedResp = angular.copy(fullSolrResp);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, copiedResp);
      var called = 0;
      searcher.search().then(function() {
        called++;
        var solrDocs = searcher.docs;
        var docId = fullSolrResp.response.docs[0].path;
        var expectedHl = null; 
        expect(solrDocs[0].highlight(docId, 'content')).toEqual(expectedHl);
        docId = fullSolrResp.response.docs[1].path;
        expectedHl = null;
        expect(solrDocs[1].highlight(docId, 'content')).toEqual(expectedHl);
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
    
    beforeEach(function() {
      fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      searcher = solrSearchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParams, mockQueryText);
    });

    it('populates explain()', function() {
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                              .respond(200, fullSolrResp);
      searcher.search().then(function() {
        var solrDocs = searcher.docs;
        expect(solrDocs[0].explain('http://larkin.com/index/')).toEqual('\n1.0 = (MATCH) MatchAllDocsQuery, product of:\n  1.0 = queryNorm\n');
        expect(solrDocs[1].explain('http://www.rogahnbins.com/main.html')).toEqual('\n1.0 = (MATCH) MatchAllDucksQuery, product of:\n  1.0 = queryNorm\n');
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('returns null on no explain', function() {
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
  });
 
  // For tests where "id" is not the id field 
  
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
      searcher = solrSearchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
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
          expect(generatedUrl.indexOf('q=altId:' + queryDoc.altId)).toNotBe(-1);
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
      var searcher = solrSearchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
                                                  mockSolrParamsWithMm, mockQueryText);
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParamsMm))
                              .respond(200, mockResultsAltId);
      searcher.search();
      $httpBackend.verifyNoOutstandingExpectation();

    });
    

  });

  
  it('encodes the url characters', function() {
    var s = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
    var e = '%20!%22%23%24%25%26\'()*%2B%2C-.%2F0123456789%3A%3B%3C%3D%3E%3F%40ABCDEFGHIJKLMNOPQRSTUVWXYZ%5B%5C%5D%5E_%60abcdefghijklmnopqrstuvwxyz%7B%7C%7D~';
    expect(e).toEqual(encodeURIComponent(s));
  });
 
  it('makes querydocs with tokensUrl', function() {
    var searcher = solrSearchSvc.createSearcher(mockFieldSpec.fieldList(), mockSolrUrl,
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
    var searcher = solrSearchSvc.createSearcher(mockFieldSpec.fieldList(), mockSolrUrl,
                                                mockSolrParams, mockQueryText);
    $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
                            .respond(200, mockResults);
    searcher.search().then(function() {
      var solrDocs = searcher.docs;
      angular.forEach(solrDocs, function(doc) {
        var tokenUrl = doc.url('id', 'http://12');
        expect(tokenUrl.indexOf('http://12')).toBe(-1);
        var encId = encodeURIComponent('http\\://12');
        expect(tokenUrl.indexOf(encId)).toNotBe(-1);
      });
    });
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });
  
  it('doesnt include score in facetfield', function() {
    var fieldSpecWithScore = fieldSpecSvc.createFieldSpec('field field1 score');
    var searcher = solrSearchSvc.createSearcher(fieldSpecWithScore.fieldList(), mockSolrUrl,
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
    var searcher = solrSearchSvc.createSearcher(fieldSpecWithScore.fieldList(), mockSolrUrl,
                                                mockSolrParams, mockQueryText);
    expect(searcher.linkUrl.indexOf('wt=xml')).toNotBe(-1);

  });
  
  it('sanitizes solr arguments', function() {
    var fieldSpecWithScore = fieldSpecSvc.createFieldSpec('field field1 score');
    var mockUncleanSolrParams = angular.copy(mockSolrParams);
    // make it filthy with these params we need to strip out!
    mockUncleanSolrParams.wt = ['xml'];
    mockUncleanSolrParams.rows = ['20'];
    mockUncleanSolrParams.debug = ['true'];
    var searcher = solrSearchSvc.createSearcher(fieldSpecWithScore.fieldList(), mockSolrUrl,
                                                mockUncleanSolrParams, mockQueryText);
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
    var searcher = solrSearchSvc.createSearcher(fieldSpecWithScore.fieldList(), mockSolrUrl,
                                                mockUncleanSolrParams, mockQueryText, true);
    $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, mockUncleanSolrParams))
                            .respond(200, mockResults);
    searcher.search();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    
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
      searcher = solrSearchSvc.createSearcher(fieldSpec.fieldList(), mockSolrUrl,
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

  var lizsResp = {

  "responseHeader": {

    "status": 0,

    "QTime": 3,

    "params": {

      "df": "text_all",

      "echoParams": "all",

      "rows": "10",

      "debugQuery": "true",

      "fl": "id pageName",

      "indent": "true",

      "q": "sed",

      "wt": "json",

      "fq": "ip:9781565922259"

    }

  },

  "response": {

    "numFound": 133,

    "start": 0,

    "docs": [

      {

        "pageName": [

          "Appendix A. Quick Reference for sed"

        ],

        "id": "ip-9781565922259/440"

      },

      {

        "pageName": [

          "Syntax of sed Commands"

        ],

        "id": "ip-9781565922259/444"

      },

      {

        "pageName": [

          "Availability of sed and awk"

        ],

        "id": "ip-9781565922259/12"

      },

      {

        "pageName": [

          "sed & awk, 2nd Edition"

        ],

        "id": "ip-9781565922259/2"

      },

      {

        "pageName": [

          "Advanced Flow Control Commands"

        ],

        "id": "ip-9781565922259/174"

      },

      {

        "pageName": [

          "Index"

        ],

        "id": "ip-9781565922259/487"

      },

      {

        "pageName": [

          "Using sed"

        ],

        "id": "ip-9781565922259/41"

      },

      {

        "pageName": [

          "Chapter 5. Basic sed Commands"

        ],

        "id": "ip-9781565922259/123"

      },

      {

        "pageName": [

          "Index"

        ],

        "id": "ip-9781565922259/490"

      },

      {

        "pageName": [

          "Command-Line Syntax"

        ],

        "id": "ip-9781565922259/441"

      }

    ]

  },

  "debug": {

    "rawquerystring": "sed",

    "querystring": "sed",

    "parsedquery": "text_all:sed",

    "parsedquery_toString": "text_all:sed",

    "explain": {

      "ip-9781565922259/440": "\n0.7696601 = (MATCH) weight(text_all:sed in 441) [LucidMultiLenNormSimilarity], result of:\n  0.7696601 = fieldWeight in 441, product of:\n    1.0 = tf(freq=1.0), with freq of:\n      1.0 = termFreq=1.0\n    2.4629123 = idf(docFreq=134, maxDocs=583)\n    0.3125 = fieldNorm(doc=441)\n",

      "ip-9781565922259/444": "\n0.7696601 = (MATCH) weight(text_all:sed in 445) [LucidMultiLenNormSimilarity], result of:\n  0.7696601 = fieldWeight in 445, product of:\n    1.0 = tf(freq=1.0), with freq of:\n      1.0 = termFreq=1.0\n    2.4629123 = idf(docFreq=134, maxDocs=583)\n    0.3125 = fieldNorm(doc=445)\n",

      "ip-9781565922259/12": "\n0.6157281 = (MATCH) weight(text_all:sed in 13) [LucidMultiLenNormSimilarity], result of:\n  0.6157281 = fieldWeight in 13, product of:\n    1.0 = tf(freq=1.0), with freq of:\n      1.0 = termFreq=1.0\n    2.4629123 = idf(docFreq=134, maxDocs=583)\n    0.25 = fieldNorm(doc=13)\n",

      "ip-9781565922259/2": "\n0.5387621 = (MATCH) weight(text_all:sed in 3) [LucidMultiLenNormSimilarity], result of:\n  0.5387621 = fieldWeight in 3, product of:\n    1.0 = tf(freq=1.0), with freq of:\n      1.0 = termFreq=1.0\n    2.4629123 = idf(docFreq=134, maxDocs=583)\n    0.21875 = fieldNorm(doc=3)\n",

      "ip-9781565922259/174": "\n0.46179605 = (MATCH) weight(text_all:sed in 175) [LucidMultiLenNormSimilarity], result of:\n  0.46179605 = fieldWeight in 175, product of:\n    1.0 = tf(freq=1.0), with freq of:\n      1.0 = termFreq=1.0\n    2.4629123 = idf(docFreq=134, maxDocs=583)\n    0.1875 = fieldNorm(doc=175)\n",

      "ip-9781565922259/487": "\n0.44087824 = (MATCH) weight(text_all:sed in 488) [LucidMultiLenNormSimilarity], result of:\n  0.44087824 = fieldWeight in 488, product of:\n    4.582576 = tf(freq=21.0), with freq of:\n      21.0 = termFreq=21.0\n    2.4629123 = idf(docFreq=134, maxDocs=583)\n    0.0390625 = fieldNorm(doc=488)\n",

      "ip-9781565922259/41": "\n0.4353855 = (MATCH) weight(text_all:sed in 42) [LucidMultiLenNormSimilarity], result of:\n  0.4353855 = fieldWeight in 42, product of:\n    1.4142135 = tf(freq=2.0), with freq of:\n      2.0 = termFreq=2.0\n    2.4629123 = idf(docFreq=134, maxDocs=583)\n    0.125 = fieldNorm(doc=42)\n",

      "ip-9781565922259/123": "\n0.4353855 = (MATCH) weight(text_all:sed in 124) [LucidMultiLenNormSimilarity], result of:\n  0.4353855 = fieldWeight in 124, product of:\n    1.4142135 = tf(freq=2.0), with freq of:\n      2.0 = termFreq=2.0\n    2.4629123 = idf(docFreq=134, maxDocs=583)\n    0.125 = fieldNorm(doc=124)\n",

      "ip-9781565922259/490": "\n0.4259288 = (MATCH) weight(text_all:sed in 491) [LucidMultiLenNormSimilarity], result of:\n  0.4259288 = fieldWeight in 491, product of:\n    6.3245554 = tf(freq=40.0), with freq of:\n      40.0 = termFreq=40.0\n    2.4629123 = idf(docFreq=134, maxDocs=583)\n    0.02734375 = fieldNorm(doc=491)\n",

      "ip-9781565922259/441": "\n0.40726584 = (MATCH) weight(text_all:sed in 442) [LucidMultiLenNormSimilarity], result of:\n  0.40726584 = fieldWeight in 442, product of:\n    2.6457512 = tf(freq=7.0), with freq of:\n      7.0 = termFreq=7.0\n    2.4629123 = idf(docFreq=134, maxDocs=583)\n    0.0625 = fieldNorm(doc=442)\n"

    },

    "QParser": "LuceneQParser",

    "filter_queries": [

      "ip:9781565922259"

    ],

    "parsed_filter_queries": [

      "ip:9781565922259"

    ],

    "timing": {

      "time": 3.0,

      "prepare": {

        "time": 1.0,

        "query": {

          "time": 0.0

        },

        "facet": {

          "time": 0.0

        },

        "mlt": {

          "time": 1.0

        },

        "highlight": {

          "time": 0.0

        },

        "stats": {

          "time": 0.0

        },

        "debug": {

          "time": 0.0

        }

      },

      "process": {

        "time": 2.0,

        "query": {

          "time": 0.0

        },

        "facet": {

          "time": 0.0

        },

        "mlt": {

          "time": 0.0

        },

        "highlight": {

          "time": 0.0

        },

        "stats": {

          "time": 0.0

        },

        "debug": {

          "time": 2.0

        }

      }

    }

  }

}


});

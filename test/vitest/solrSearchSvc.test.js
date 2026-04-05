import { describe, it, expect, beforeEach } from 'vitest';
import { createFetchClient } from '../../services/httpClient.js';
import { MockHttpBackend } from './helpers/mockHttpBackend.js';
import {
  urlContainsParams,
  urlMissingParams,
  urlHasBasicAuth,
  urlHasNoBasicAuth,
} from './helpers/mockHelpers.js';
import { mockExplainOther } from './helpers/mockData.js';
import { getSearchSvc, getFieldSpecSvc } from './helpers/serviceFactory.js';
import { activeQueries } from '../../values/activeQueries.js';

describe('searchSvc: Solr', () => {
  var searchSvc;
  var fieldSpecSvc;
  var mockBackend;
  var mockSolrUrl = 'http://example.com:1234/solr/select';
  var mockSolrParams = {
    q: ['#$query##'],
    fq: ['field:value', 'field1:value', 'field2:#$query##']
  };
  var expectedParams = structuredClone(mockSolrParams);
  var mockQueryText = 'query text';
  var mockFieldSpec = null;
  expectedParams.q[0] = encodeURIComponent(mockQueryText);
  expectedParams.fq[2] = 'field2:' + encodeURIComponent(mockQueryText);
  var mockResults = {
    response: {
      numFound: 2,
      docs: [{ id: 'doc1' }, { id: 'doc2' }]
    }
  };

  beforeEach(() => {
    mockBackend = new MockHttpBackend();
    var httpClient = createFetchClient({
      fetch: mockBackend.fetch,
      jsonpRequest: mockBackend.jsonpRequest,
    });
    searchSvc = getSearchSvc(httpClient);
    fieldSpecSvc = getFieldSpecSvc();
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1 hl:field2');
    activeQueries.count = 0;
  });

  it('access solr with mock solr params using JSONP', async () => {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
      mockSolrParams, mockQueryText);
    mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
      .respond(200, mockResults);
    await searcher.search();
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('access solr with mock solr params using GET', async () => {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
      mockSolrParams, mockQueryText, { apiMethod: 'GET' });
    mockBackend.expectGET(urlContainsParams(mockSolrUrl, expectedParams))
      .respond(200, mockResults);
    await searcher.search();
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('strips out username and password from url and converts to header property', async () => {
    var authSolrUrl = 'http://username:password@example.com:1234/solr/select';
    var searcher = searchSvc.createSearcher(
      mockFieldSpec, authSolrUrl, mockSolrParams, mockQueryText,
      { apiMethod: 'GET' }, 'solr'
    );

    var expectedHeaders = {
      Authorization: 'Basic ' + btoa('username:password')
    };

    mockBackend.expectGET(urlHasNoBasicAuth(), expectedHeaders).respond(200, mockResults);
    await searcher.search();
    mockBackend.verifyNoOutstandingExpectation();
    expect(searchSvc.activeQueries()).toEqual(0);
  });

  it('With JSONP, it preserves the username and password in the URL and does NOT add it to header property', async () => {
    var authSolrUrl = 'http://username:password@example.com:1234/solr/select';
    var searcher = searchSvc.createSearcher(
      mockFieldSpec, authSolrUrl, mockSolrParams, mockQueryText,
      { apiMethod: 'JSONP' }, 'solr'
    );

    mockBackend.expectJSONP(urlHasBasicAuth()).respond(200, mockResults);
    await searcher.search();
    mockBackend.verifyNoOutstandingExpectation();
    expect(searchSvc.activeQueries()).toEqual(0);
  });

  it('Pass basic auth through the headers', async () => {
    var searcher = searchSvc.createSearcher(
      mockFieldSpec, mockSolrUrl, mockSolrParams, mockQueryText,
      { apiMethod: 'GET', customHeaders: '{\n "Authorization": "Basic ' + btoa('username:password') + '"\n}' },
      'solr'
    );

    var expectedHeaders = {
      Authorization: 'Basic ' + btoa('username:password')
    };

    mockBackend.expectGET(urlHasNoBasicAuth(), expectedHeaders).respond(200, mockResults);
    await searcher.search();
    mockBackend.verifyNoOutstandingExpectation();
    expect(searchSvc.activeQueries()).toEqual(0);
  });

  it('tracks active queries', async () => {
    expect(searchSvc.activeQueries()).toEqual(0);
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
      mockSolrParams, mockQueryText);
    mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
      .respond(200, mockResults);
    var p = searcher.search();
    expect(searchSvc.activeQueries()).toEqual(1);
    await p;
    mockBackend.verifyNoOutstandingExpectation();
    expect(searchSvc.activeQueries()).toEqual(0);
  });

  describe('highlights', () => {
    var fullSolrResp = {
      responseHeader: {
        status: 0, QTime: 1,
        params: {
          df: 'content', echoParams: 'all', rows: '2', debugQuery: 'true',
          fl: 'path content', indent: ['true', 'true'], q: '*:*', wt: 'json',
        }
      },
      response: {
        numFound: 100, start: 0,
        docs: [
          { content: 'stuff', path: 'http://larkin.com/index/' },
          { content: 'more stuff', path: 'http://www.rogahnbins.com/main.html' }
        ]
      }
    };

    var highlighting = null;
    var searcher = null;

    var createSearcherHlOn = function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:hl:path hl:content');
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl, mockSolrParams, mockQueryText);
    };

    var createSearcherHlOff = function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      var noHlConfig = searchSvc.configFromDefault();
      noHlConfig.highlight = false;
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl, mockSolrParams, mockQueryText, noHlConfig);
    };

    var expectedHlParams = null;

    beforeEach(() => {
      highlighting = {
        'http://larkin.com/index/': {
          content: searchSvc.HIGHLIGHTING_PRE + 'highlighted larkin' + searchSvc.HIGHLIGHTING_POST,
          contentHlBold: '<b>highlighted larkin</b>'
        },
        'http://www.rogahnbins.com/main.html': {
          content: searchSvc.HIGHLIGHTING_PRE + 'highlighted rogah' + searchSvc.HIGHLIGHTING_POST,
          contentHlBold: '<b>highlighted rogah</b>'
        }
      };

      expectedHlParams = {
        hl: ['true'],
        'hl.simple.pre': [searchSvc.HIGHLIGHTING_PRE],
        'hl.simple.post': [searchSvc.HIGHLIGHTING_POST],
        'hl.fl': ['path content']
      };
    });

    it('asks for highlights', async () => {
      createSearcherHlOn();
      var copiedResp = structuredClone(fullSolrResp);
      copiedResp.highlighting = highlighting;

      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedHlParams))
        .respond(200, copiedResp);
      var called = 0;
      await searcher.search().then(function() { called++; });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('gets highlight snippet field values if returned', async () => {
      createSearcherHlOn();
      var copiedResp = structuredClone(fullSolrResp);
      copiedResp.highlighting = highlighting;
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, copiedResp);
      var called = 0;
      await searcher.search().then(function() {
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
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('gets null if no highlights for field', async () => {
      createSearcherHlOn();
      var copiedResp = structuredClone(fullSolrResp);
      copiedResp.highlighting = highlighting;
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, copiedResp);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        var solrDocs = searcher.docs;
        var docId = fullSolrResp.response.docs[0].path;
        expect(solrDocs[0].snippet(docId, 'some_other_field')).toEqual(null);
        expect(solrDocs[0].highlight(docId, 'some_other_field', '<b>', '</b>')).toEqual(null);
        docId = fullSolrResp.response.docs[1].path;
        expect(solrDocs[1].snippet(docId, 'yet_another_field')).toEqual(null);
        expect(solrDocs[1].highlight(docId, 'yet_another_field', '<b>', '</b>')).toEqual(null);
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('gets null if no highlights', async () => {
      createSearcherHlOn();
      var copiedResp = structuredClone(fullSolrResp);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, copiedResp);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        var solrDocs = searcher.docs;
        var docId = fullSolrResp.response.docs[0].path;
        expect(solrDocs[0].snippet(docId, 'content')).toEqual(null);
        expect(solrDocs[0].highlight(docId, 'content', '<b>', '</b>')).toEqual(null);
        docId = fullSolrResp.response.docs[1].path;
        expect(solrDocs[1].snippet(docId, 'content')).toEqual(null);
        expect(solrDocs[1].highlight(docId, 'content', '<b>', '</b>')).toEqual(null);
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('doesnt request hls if hls off', async () => {
      createSearcherHlOff();
      var copiedResp = structuredClone(fullSolrResp);
      mockBackend.expectJSONP(urlMissingParams(mockSolrUrl, expectedHlParams))
        .respond(200, copiedResp);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        var solrDocs = searcher.docs;
        var docId = fullSolrResp.response.docs[0].path;
        expect(solrDocs[0].snippet(docId, 'content')).toEqual(null);
        expect(solrDocs[0].highlight(docId, 'content', '<b>', '</b>')).toEqual(null);
        docId = fullSolrResp.response.docs[1].path;
        expect(solrDocs[1].snippet(docId, 'content')).toEqual(null);
        expect(solrDocs[0].highlight(docId, 'content', '<b>', '</b>')).toEqual(null);
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });
  });

  describe('explain info', () => {
    var fullSolrResp = {
      responseHeader: {
        status: 0, QTime: 1,
        params: {
          df: 'content', echoParams: 'all', rows: '2', debugQuery: 'true',
          fl: 'path content', indent: ['true', 'true'], q: '*:*', wt: 'json',
        }
      },
      response: {
        numFound: 100, start: 0,
        docs: [
          { content: 'stuff', path: 'http://larkin.com/index/' },
          { content: 'more stuff', path: 'http://www.rogahnbins.com/main.html' }
        ]
      },
      debug: {
        rawquerystring: '*:*',
        querystring: '*:*',
        parsedquery: 'MatchAllDocsQuery(*:*)',
        parsedquery_toString: '*:*',
        explain: {
          'http://larkin.com/index/': '\n1.0 = (MATCH) MatchAllDocsQuery, product of:\n  1.0 = queryNorm\n',
          'http://www.rogahnbins.com/main.html': '\n1.0 = (MATCH) MatchAllDucksQuery, product of:\n  1.0 = queryNorm\n'
        },
        explainOther: {
          'http://snarkin.com/index/': mockExplainOther.l514,
          'http://ploppers.com/main.html': mockExplainOther.l71
        },
        QParser: 'LuceneQParser',
        timing: {
          time: 11.0,
          prepare: {
            time: 1.0,
            query: { time: 1.0 }, facet: { time: 0.0 }, mlt: { time: 0.0 },
            highlight: { time: 0.0 }, stats: { time: 0.0 }, debug: { time: 0.0 }
          },
          process: {
            time: 6.0,
            query: { time: 3.0 }, facet: { time: 0.0 }, mlt: { time: 0.0 },
            highlight: { time: 0.0 }, stats: { time: 0.0 }, debug: { time: 0.0 }
          }
        }
      }
    };
    var fieldSpec = null;
    var searcher = null;
    var expectedDebugParams = null;

    beforeEach(() => {
      expectedDebugParams = { debug: ['true'], 'debug.explain.structured': ['true'] };
    });

    var createSearcherWithDebug = function() {
      fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl, mockSolrParams, mockQueryText);
    };

    var createSearcherDebugOff = function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      var noDebugConfig = searchSvc.configFromDefault();
      noDebugConfig.debug = false;
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl, mockSolrParams, mockQueryText, noDebugConfig);
    };

    var mockQuerqyInfolog = {
      common_rules: [{ APPLIED_RULES: ['92e016b6-c2ad-4672-bb93-73791d94d6ca'] }]
    };
    var mockQuerqyDecorations = ['REDIRECT https://www.example.org/'];

    it('populates explain()', async () => {
      createSearcherWithDebug();
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
        .respond(200, fullSolrResp);
      await searcher.search().then(function() {
        var solrDocs = searcher.docs;
        expect(solrDocs[0].explain('http://larkin.com/index/')).toEqual('\n1.0 = (MATCH) MatchAllDocsQuery, product of:\n  1.0 = queryNorm\n');
        expect(solrDocs[1].explain('http://www.rogahnbins.com/main.html')).toEqual('\n1.0 = (MATCH) MatchAllDucksQuery, product of:\n  1.0 = queryNorm\n');
      });
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('populates others explained', async () => {
      createSearcherWithDebug();
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
        .respond(200, fullSolrResp);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        var othersExplained = searcher.othersExplained;
        expect(Object.keys(othersExplained).length).toBe(2);
        expect(Object.hasOwn(othersExplained, 'http://snarkin.com/index/')).toBe(true);
        expect(othersExplained['http://snarkin.com/index/']).toEqual(mockExplainOther.l514);
        expect(Object.hasOwn(othersExplained, 'http://ploppers.com/main.html')).toBe(true);
        expect(othersExplained['http://ploppers.com/main.html']).toEqual(mockExplainOther.l71);
      });
      expect(called).toBe(1);
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('populates parsed query details', async () => {
      createSearcherWithDebug();
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
        .respond(200, fullSolrResp);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        var parsedQueryDetails = searcher.parsedQueryDetails;
        expect(Object.keys(parsedQueryDetails).length).toBe(5);
        expect(parsedQueryDetails.rawquerystring).toEqual('*:*');
        expect(parsedQueryDetails.querystring).toEqual('*:*');
        expect(parsedQueryDetails.parsedquery).toEqual('MatchAllDocsQuery(*:*)');
        expect(parsedQueryDetails.parsedquery_toString).toEqual('*:*');
        expect(parsedQueryDetails.QParser).toEqual('LuceneQParser');
      });
      expect(called).toBe(1);
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('identifies querqy.infoLogging presence and adds to parsedQueryDetails', async () => {
      createSearcherWithDebug();
      var mockSolrResultsWithQuerqyInfolog = structuredClone(fullSolrResp);
      mockSolrResultsWithQuerqyInfolog['querqy.infoLog'] = mockQuerqyInfolog;

      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
        .respond(200, mockSolrResultsWithQuerqyInfolog);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        var parsedQueryDetails = searcher.parsedQueryDetails;
        expect(Object.keys(parsedQueryDetails).length).toBe(6);
        expect(parsedQueryDetails.rawquerystring).toEqual('*:*');
        expect(parsedQueryDetails['querqy.infoLog']).toEqual(mockQuerqyInfolog);
      });
      expect(called).toBe(1);
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('identifies querqy_decorations presence and adds to parsedQueryDetails', async () => {
      createSearcherWithDebug();
      var mockSolrResultsWithQuerqyDecorations = structuredClone(fullSolrResp);
      mockSolrResultsWithQuerqyDecorations.querqy_decorations = mockQuerqyDecorations;

      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
        .respond(200, mockSolrResultsWithQuerqyDecorations);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        var parsedQueryDetails = searcher.parsedQueryDetails;
        expect(Object.keys(parsedQueryDetails).length).toBe(6);
        expect(parsedQueryDetails.rawquerystring).toEqual('*:*');
        expect(parsedQueryDetails.querqy_decorations).toEqual(mockQuerqyDecorations);
      });
      expect(called).toBe(1);
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('populates raw query details', async () => {
      createSearcherWithDebug();
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
        .respond(200, fullSolrResp);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        var queryDetails = searcher.queryDetails;
        expect(Object.keys(queryDetails).length).toBe(8);
        expect(queryDetails.df).toEqual('content');
        expect(queryDetails.indent).toEqual(['true', 'true']);
      });
      expect(called).toBe(1);
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('populates query timing details', async () => {
      createSearcherWithDebug();
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
        .respond(200, fullSolrResp);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        var timingDetails = searcher.timingDetails;
        expect(Object.keys(timingDetails.events).length).toBe(12);
        expect(timingDetails.events[6].name).toEqual('process_query');
        expect(timingDetails.events[6].duration).toEqual(3);
      });
      expect(called).toBe(1);
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('returns empty hash on no params', async () => {
      createSearcherWithDebug();
      var copiedResp = structuredClone(fullSolrResp);
      delete copiedResp.responseHeader;
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedDebugParams))
        .respond(200, copiedResp);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        expect(searcher.queryDetails).toEqual({});
      });
      expect(called).toBe(1);
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('returns null on no explain', async () => {
      createSearcherWithDebug();
      var copiedResp = structuredClone(fullSolrResp);
      delete copiedResp.debug;
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, copiedResp);
      await searcher.search().then(function() {
        var solrDocs = searcher.docs;
        expect(solrDocs[0].explain('http://larkin.com/index/')).toBe(null);
        expect(solrDocs[1].explain('http://www.rogahnbins.com/main.html')).toBe(null);
      });
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('doesnt request debug info when configured not to', async () => {
      createSearcherDebugOff();
      var copiedResp = structuredClone(fullSolrResp);
      delete copiedResp.debug;
      mockBackend.expectJSONP(urlMissingParams(mockSolrUrl, expectedDebugParams))
        .respond(200, copiedResp);
      await searcher.search().then(function() {
        var solrDocs = searcher.docs;
        expect(solrDocs[0].explain('http://larkin.com/index/')).toBe(null);
        expect(solrDocs[1].explain('http://www.rogahnbins.com/main.html')).toBe(null);
      });
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('handles parsing the debug json when debug is set to null versus empty array', async () => {
      createSearcherWithDebug();
      var copiedResp = structuredClone(fullSolrResp);
      copiedResp.debug = null;
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, copiedResp);
      await searcher.search().then(function() {
        var solrDocs = searcher.docs;
        expect(solrDocs[0].explain('http://larkin.com/index/')).toBe(null);
        expect(solrDocs[1].explain('http://www.rogahnbins.com/main.html')).toBe(null);
      });
      mockBackend.verifyNoOutstandingExpectation();
    });
  });

  describe('alt id field tests', () => {
    var mockResultsAltId = {
      response: {
        numFound: 2,
        docs: [{ altId: 'alt_doc1' }, { altId: 'alt_doc2' }]
      }
    };

    var fieldSpec = null;
    var searcher = null;
    beforeEach(() => {
      fieldSpec = fieldSpecSvc.createFieldSpec('id:altId');
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl, mockSolrParams, mockQueryText);
    });

    it('works with an alternate id field', async () => {
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, mockResultsAltId);
      await searcher.search().then(function() {
        var numDocs = searcher.numFound;
        var solrDocs = searcher.docs;
        expect(solrDocs.length).toEqual(2);
        expect(numDocs).toEqual(2);
        solrDocs.forEach(function(queryDoc) {
          expect(['alt_doc1', 'alt_doc2']).toContain(queryDoc.altId);
        });
      });
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('creates docs that can construct tokens URL', async () => {
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, mockResultsAltId);
      await searcher.search().then(function() {
        var numDocs = searcher.numFound;
        var solrDocs = searcher.docs;
        expect(solrDocs.length).toEqual(2);
        expect(numDocs).toEqual(2);
        solrDocs.forEach(function(queryDoc) {
          var generatedUrl = queryDoc._url('altId', queryDoc.altId);
          expect(generatedUrl.indexOf('q=altId:' + queryDoc.altId)).not.toBe(-1);
        });
      });
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('escapes percents in the query', async () => {
      var mockSolrParamsWithMm = structuredClone(mockSolrParams);
      mockSolrParamsWithMm.mm = ['100%'];
      var expectedParamsMm = structuredClone(expectedParams);
      mockSolrParamsWithMm.mm = ['100%25'];
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:altId');
      var searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl, mockSolrParamsWithMm, mockQueryText);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParamsMm))
        .respond(200, mockResultsAltId);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });
  });

  describe('encode URL', () => {
    it('encodes the url characters', () => {
      var s = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
      var e = '%20!%22%23%24%25%26\'()*%2B%2C-.%2F0123456789%3A%3B%3C%3D%3E%3F%40ABCDEFGHIJKLMNOPQRSTUVWXYZ%5B%5C%5D%5E_%60abcdefghijklmnopqrstuvwxyz%7B%7C%7D~';
      expect(e).toEqual(encodeURIComponent(s));
    });
  });

  describe('search', () => {
    it('passes the rows param and sets it to 10 by default', async () => {
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, mockSolrParams, mockQueryText);
      var expectedSearchParams = structuredClone(expectedParams);
      expectedSearchParams.rows = ['10'];

      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedSearchParams))
        .respond(200, mockResults);
      var called = 0;
      await searcher.search().then(function() { called++; });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('passes the rows param and sets it to what is passed in the config', async () => {
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, mockSolrParams, mockQueryText, { numberOfRows: 30 });
      var expectedSearchParams = structuredClone(expectedParams);
      expectedSearchParams.rows = ['30'];

      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedSearchParams))
        .respond(200, mockResults);
      var called = 0;
      await searcher.search().then(function() { called++; });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('makes querydocs with document url with NO facet', async () => {
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, mockSolrParams, mockQueryText);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, mockResults);

      await searcher.search().then(function() {
        var solrDocs = searcher.docs;
        var expectedFacetField = { 'facet.field': ['field1', 'field'] };
        solrDocs.forEach(function(doc) {
          expect(urlContainsParams(mockSolrUrl, expectedFacetField).test(doc._url('id', '12'))).toBeFalsy();
          expect(doc._url('id', '12').indexOf('wt=json')).not.toBe(-1);
        });
      });
      mockBackend.verifyNoOutstandingExpectation();
    });

    // SUSS_USE_OF_ESCAPING — pending product decision; unskip to run body.
    it.skip('escapes ids passed into url', async () => {
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl,
        mockSolrParams, mockQueryText);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, mockResults);
      await searcher.search().then(function() {
        var solrDocs = searcher.docs;
        solrDocs.forEach(function(doc) {
          var tokenUrl = doc._url('id', 'http://12');
          expect(tokenUrl.indexOf('http://12')).toBe(-1);
          var encId = encodeURIComponent('http\\://12');
          expect(tokenUrl.indexOf(encId)).not.toBe(-1);
        });
      });
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('linkurl has wt=json', () => {
      var fieldSpecWithScore = fieldSpecSvc.createFieldSpec('field field1 score');
      var searcher = searchSvc.createSearcher(fieldSpecWithScore, mockSolrUrl, mockSolrParams, mockQueryText);
      expect(searcher.linkUrl.indexOf('wt=json')).not.toBe(-1);
    });

    it('linkurl has wt=json even when specified as wt=xml', () => {
      var fieldSpecWithScore = fieldSpecSvc.createFieldSpec('field field1 score');
      var params = {
        q: ['#$query##'],
        fq: ['field:value', 'field1:value', 'field2:#$query##'],
        wt: 'xml'
      };
      var searcher = searchSvc.createSearcher(fieldSpecWithScore, mockSolrUrl, params, mockQueryText);
      expect(searcher.linkUrl.indexOf('wt=json')).not.toBe(-1);
    });

    it('sanitizes solr arguments', async () => {
      var fieldSpecWithScore = fieldSpecSvc.createFieldSpec('field field1 score');
      var mockUncleanSolrParams = structuredClone(mockSolrParams);
      mockUncleanSolrParams.wt = ['xml'];
      mockUncleanSolrParams.rows = ['20'];
      mockUncleanSolrParams.debug = ['true'];
      var searcher = searchSvc.createSearcher(fieldSpecWithScore, mockSolrUrl, mockUncleanSolrParams, mockQueryText);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('doesnt sanitize solr arguments when told not to', async () => {
      var fieldSpecWithScore = fieldSpecSvc.createFieldSpec('field field1 score');
      var mockUncleanSolrParams = {};
      mockUncleanSolrParams.rows = ['20'];
      var searcher = searchSvc.createSearcher(fieldSpecWithScore, mockSolrUrl, mockUncleanSolrParams, mockQueryText, { sanitize: false });
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, mockUncleanSolrParams))
        .respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('searches with fl == *', async () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('*');
      var searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl, { q: ['*:*'] }, mockQueryText);
      var testSolrParams = { fl: ['*'] };
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, testSolrParams))
        .respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('escape special chars in queryText', async () => {
      var thisExpectedParams = structuredClone(expectedParams);
      var queryWithSpecialChars = '+-!(){}[]^"~*?:\\';
      var escapedQuery = '\\+\\-\\!\\(\\)\\{\\}\\[\\]\\^\\"\\~\\*\\?\\:\\\\';
      thisExpectedParams.q[0] = encodeURIComponent(escapedQuery);
      thisExpectedParams.fq[2] = 'field2:' + encodeURIComponent(escapedQuery);

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, mockSolrParams, queryWithSpecialChars, { escapeQuery: true });
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, thisExpectedParams))
        .respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });
  });

  describe('group-by', () => {
    var groupedSolrResp = {
      responseHeader: { status: 0, QTime: 3 },
      grouped: {
        catch_line: {
          matches: 20148,
          groups: [{
            groupValue: 'would',
            doclist: { numFound: 547, start: 0, docs: [
              { id: 'l_510', catch_line: 'doug put this here' }
            ]}
          }]
        },
        text: {
          matches: 20148,
          groups: [{
            groupValue: 'would',
            doclist: { numFound: 547, start: 0, docs: [
              { id: 'l_11730', catch_line: 'Definitions.' },
              { id: 'l_22002', catch_line: '(Effective until October 1, 2012) Frequency of inspection; scope of inspection.' },
              { id: 'l_3845', catch_line: 'Alternate procedure for sale of real estate of person under disability.' }
            ]}
          }, {
            groupValue: 'within',
            doclist: { numFound: 1471, start: 0, docs: [
              { id: 'l_5780', catch_line: 'Approved plan required for issuance of grading, building, or other permits; security for performance.' },
              { id: 'l_16271', catch_line: 'Consultation with health regulatory boards.' },
              { id: 'l_20837', catch_line: 'Powers, duties and responsibilities of the Inspector.' }
            ]}
          }]
        }
      },
      highlighting: {
        l_11730: {}, l_22002: {}, l_3845: {},
        l_5780: {}, l_16271: {}, l_20837: {}
      },
      debug: {
        rawquerystring: '*:*', querystring: '*:*',
        parsedquery: 'MatchAllDocsQuery(*:*)', parsedquery_toString: '*:*',
        explain: {
          l_11730: { match: true, value: 1.0, description: 'MatchAllDocsQuery, product of:', details: [{ match: true, value: 1.0, description: 'queryNorm' }] },
          l_22002: { match: true, value: 1.0, description: 'MatchAllDocsQuery, product of:', details: [{ match: true, value: 1.0, description: 'queryNorm' }] },
          l_3845: { match: true, value: 1.0, description: 'MatchAllDocsQuery, product of:', details: [{ match: true, value: 1.0, description: 'queryNorm' }] },
          l_5780: { match: true, value: 1.0, description: 'MatchAllDocsQuery, product of:', details: [{ match: true, value: 1.0, description: 'queryNorm' }] },
          l_16271: { match: true, value: 1.0, description: 'MatchAllDocsQuery, product of:', details: [{ match: true, value: 1.0, description: 'queryNorm' }] },
          l_20837: { match: true, value: 1.0, description: 'MatchAllDocsQuery, product of:', details: [{ match: true, value: 1.0, description: 'queryNorm' }] }
        },
        QParser: 'LuceneQParser',
        timing: {
          time: 3.0,
          prepare: { time: 0.0, query: { time: 0.0 }, facet: { time: 0.0 }, mlt: { time: 0.0 }, highlight: { time: 0.0 }, stats: { time: 0.0 }, expand: { time: 0.0 }, debug: { time: 0.0 } },
          process: { time: 3.0, query: { time: 1.0 }, facet: { time: 0.0 }, mlt: { time: 0.0 }, highlight: { time: 2.0 }, stats: { time: 0.0 }, expand: { time: 0.0 }, debug: { time: 0.0 } }
        }
      }
    };

    var simpleGroupedSolrResponse = {
      responseHeader: { status: 0, QTime: 17 },
      grouped: {
        BUS_LISTING_ID: {
          matches: 19, ngroups: 6,
          doclist: {
            numFound: 19, start: 0,
            docs: [
              { id: '58356', BUS_LISTING_ID: '1' },
              { id: '86192', BUS_LISTING_ID: '2' },
              { id: '158752', BUS_LISTING_ID: '3' },
              { id: '190993', BUS_LISTING_ID: '4' },
              { id: '156334', BUS_LISTING_ID: '5' },
              { id: '45291', BUS_LISTING_ID: '6' }
            ]
          }
        }
      },
      facet_counts: {
        facet_queries: {},
        facet_fields: {
          BUS_GROUP_ID: ['222221', 12, '168504', 2, '359033', 2, '832532', 1, '840097', 1, '956094', 1],
          BUS_LISTING_ID: ['222221', 12, '168504', 2, '359033', 2, '832532', 1, '840097', 1, '956094', 1],
          BUS_BUSINESS_NAME_FIRSTCHR: ['a', 16, 'r', 2, 'h', 1],
          BUS_FEATURES: ['Ads', 3, 'Business Hours', 3, 'Business Information', 3, 'Website', 3],
          BUS_CITY_EXACT: ['Prince Albert', 13, 'Beauval Forks', 2, 'Saskatoon', 2, 'Humboldt', 1, 'Indian Head', 1],
          BUS_HEADING_CODE: ['000000', 9, '005120', 4, '023200', 4, '018360', 1, '020350', 1],
        },
        facet_dates: {}, facet_ranges: {}, facet_intervals: {}, facet_heatmaps: {}
      },
      highlighting: { '58356': {}, '86192': {}, '158752': {}, '190993': {}, '156334': {}, '45291': {} }
    };

    var fieldSpec = null;
    var searcher = null;

    beforeEach(() => {
      fieldSpec = fieldSpecSvc.createFieldSpec('id catch_line');
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl, mockSolrParams, mockQueryText);
    });

    it('parses a simple grouped response', async () => {
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, simpleGroupedSolrResponse);
      await searcher.search().then(function() {
        expect(searcher.docs.length).toEqual(6);
        expect(Object.hasOwn(searcher.grouped, 'BUS_LISTING_ID')).toBe(true);
        var gpd = searcher.grouped;
        expect(gpd.BUS_LISTING_ID[0].value).toEqual('1');
      });
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('parses a grouped response', async () => {
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
        .respond(200, groupedSolrResp);
      var called = 0;
      await searcher.search()
        .then(function() {
          expect(searcher.docs.length).toEqual(7);
          expect(Object.hasOwn(searcher.grouped, 'text')).toBe(true);
          expect(Object.hasOwn(searcher.grouped, 'catch_line')).toBe(true);
          var gpd = searcher.grouped;
          expect(gpd.text[0].value).toEqual('would');
          expect(gpd.text[0].docs.length).toEqual(3);
          expect(gpd.text[0].docs[0].origin().id).toEqual('l_11730');
          expect(gpd.text[0].docs[0].group()).toEqual('would');
          expect(gpd.text[0].docs[1].origin().id).toEqual('l_22002');
          expect(gpd.text[0].docs[1].group()).toEqual('would');
          expect(gpd.text[0].docs[2].origin().id).toEqual('l_3845');
          expect(gpd.text[0].docs[2].group()).toEqual('would');
          gpd.text[0].docs.forEach(function(doc) {
            expect(doc.group()).toEqual('would');
            expect(doc.groupedBy()).toEqual('text');
          });

          expect(gpd.text[1].value).toEqual('within');
          expect(gpd.text[1].docs.length).toEqual(3);
          expect(gpd.text[1].docs[0].origin().id).toEqual('l_5780');
          expect(gpd.text[1].docs[1].origin().id).toEqual('l_16271');
          expect(gpd.text[1].docs[2].origin().id).toEqual('l_20837');
          gpd.text[1].docs.forEach(function(doc) {
            expect(doc.group()).toEqual('within');
            expect(doc.groupedBy()).toEqual('text');
          });

          gpd.catch_line[0].docs.forEach(function(doc) {
            expect(doc.group()).toEqual('would');
            expect(doc.groupedBy()).toEqual('catch_line');
          });
          called++;
        });
      expect(called).toBe(1);
    });
  });

  describe('vars', () => {
    it('does full replacement', async () => {
      var mockQT = 'burrito taco';
      var params = { q: ['#$query##'] };
      var exp = structuredClone(params);
      exp.q[0] = encodeURIComponent(mockQT);

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, params, mockQT);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, exp)).respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('does keyword replacement', async () => {
      var mockQT = 'burrito taco';
      var params = { q: ['#$keyword1## query #$keyword2##'] };
      var exp = structuredClone(params);
      exp.q[0] = 'burrito query taco';

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, params, mockQT);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, exp)).respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('extra keyword replacements turns to empty string', async () => {
      var mockQT = 'burrito taco';
      var params = { q: ['#$keyword1## query #$keyword2## nothing #$keyword3##'] };
      var exp = structuredClone(params);
      exp.q[0] = 'burrito query taco nothing ';

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, params, mockQT);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, exp)).respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('custom defaults', async () => {
      var mockQT = 'burrito taco';
      var params = { q: ['#$keyword1## query #$keyword2## nothing #$keyword3|someDefault##'] };
      var exp = structuredClone(params);
      exp.q[0] = 'burrito query taco nothing someDefault';

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, params, mockQT);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, exp)).respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('many custom defaults', async () => {
      var mockQT = 'burrito taco';
      var params = { q: ['#$keyword1## query #$keyword2## nothing #$keyword3|someDefault## #$keyword3|otherDefaults## #$keyword2##'] };
      var exp = structuredClone(params);
      exp.q[0] = 'burrito query taco nothing someDefault otherDefaults taco';

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, params, mockQT);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, exp)).respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('many custom defaults, others not customized', async () => {
      var mockQT = 'burrito taco';
      var params = { q: ['#$keyword1## query #$keyword2## nothing #$keyword3|someDefault## #$keyword3|otherDefaults## #$keyword3## #$keyword2##'] };
      var exp = structuredClone(params);
      exp.q[0] = 'burrito query taco nothing someDefault otherDefaults  taco';

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, params, mockQT);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, exp)).respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('super long query', async () => {
      var mockQT = 'burrito taco nacho bbq turkey donkey michelin stream of consciousness taco bell cannot run away from me crazy muhahahaa peanut';
      var params = { q: ['#$keyword1## query #$keyword2## nothing #$keyword3##'] };
      var exp = structuredClone(params);
      exp.q[0] = 'burrito query taco nothing nacho';

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, params, mockQT);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, exp)).respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('handles all types of vars', async () => {
      var mockQT = 'burrito taco nacho bbq turkey donkey michelin stream of consciousness taco bell cannot run away from me crazy muhahahaa peanut';
      var params = {
        phrase: ['bowl:("#$keyword1## #$keyword2##" OR "#$keyword2## #$keyword3##")'],
        q: ['_val_:"product($texmexFunc,1)"'],
      };
      var exp = structuredClone(params);
      exp.phrase[0] = 'bowl:("burrito taco" OR "taco nacho")';

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, params, mockQT);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, exp)).respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();

      params = {
        phrase: ['bowl:("#$keyword1## #$keyword2##" OR "#$keyword2## #$keyword3##")'],
        keywords: ['{!edismax qf="bowl^10 sofritas" tie=1.0}#$query##'],
        texmexFunc: ['if(query($phrase),1.5,1)'],
        q: ['_val_:"product($texmexFunc,1)"'],
        fq: ['{!edismax qf="bowl sofritas"}#$query##'],
      };
      exp = structuredClone(params);
      exp.phrase[0] = 'bowl:("burrito taco" OR "taco nacho")';
      exp.keywords[0] = '{!edismax qf="bowl^10 sofritas" tie=1.0}' + encodeURIComponent(mockQT);
      exp.fq[0] = '{!edismax qf="bowl sofritas"}' + encodeURIComponent(mockQT);

      searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, params, mockQT);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, exp)).respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();

      params = {
        phrase: ['bowl:("#$keyword1## #$keyword2##" OR "#$keyword2## #$keyword3##")'],
        keywords: ['{!edismax qf="bowl^10 sofritas" tie=1.0}#$query##'],
        phraseScore: ['div(product(sum(##k##,1),query($phrase)),product(query($phrase),##k##))'],
        texmexFunc: ['if(query($phrase),1.5,1)'],
        q: ['_val_:"product($texmexFunc,1)"'],
        fq: ['{!edismax qf="bowl sofritas"}#$query##'],
      };
      exp = structuredClone(params);
      exp.phrase[0] = 'bowl:("burrito taco" OR "taco nacho")';
      exp.keywords[0] = '{!edismax qf="bowl^10 sofritas" tie=1.0}' + encodeURIComponent(mockQT);
      exp.fq[0] = '{!edismax qf="bowl sofritas"}' + encodeURIComponent(mockQT);

      searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, params, mockQT);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, exp)).respond(200, mockResults);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });
  });

  describe('errors', () => {
    var fieldSpec = null;
    var searcher = null;

    beforeEach(() => {
      fieldSpec = fieldSpecSvc.createFieldSpec('id:path content');
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl, mockSolrParams, mockQueryText);
    });

    it('adds searchError text', async () => {
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams)).respond(-1);
      var errorCnt = 0;
      await searcher.search().then(function() { errorCnt--; },
        function error(msg) {
          errorCnt++;
          expect(msg.searchError.length).toBeGreaterThan(1);
        });
      expect(errorCnt).toBe(1);
    });
  });

  describe('paging', () => {
    var fullSolrResp = {
      responseHeader: {
        status: 0, QTime: 1,
        params: {
          df: 'content', echoParams: 'all', rows: '2', debugQuery: 'true',
          fl: 'path content', indent: ['true', 'true'], q: '*:*', wt: 'json',
        }
      },
      response: {
        numFound: 21, start: 0,
        docs: [
          { content: 'stuff', path: 'http://larkin.com/index/' },
          { content: 'more stuff', path: 'http://www.rogahnbins.com/main.html' }
        ]
      }
    };

    var fieldSpec = null;
    var searcher = null;

    beforeEach(() => {
      fieldSpec = fieldSpecSvc.createFieldSpec('id:path hl:content');
      searcher = searchSvc.createSearcher(fieldSpec, mockSolrUrl, mockSolrParams, mockQueryText);
    });

    it('does not escape the query if escapeQuery is false', () => {
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, mockSolrParams, mockQueryText, { escapeQuery: false });
      var nextSearcher = searcher.pager();
      expect(nextSearcher.config.escapeQuery).toBe(false);
    });

    it('pages on page', async () => {
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams)).respond(200, fullSolrResp);
      await searcher.search();

      var nextSearcher = searcher.pager();
      var expectedPageParams = structuredClone(expectedParams);
      expectedPageParams.rows = ['10'];
      expectedPageParams.start = ['10'];
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedPageParams)).respond(200, fullSolrResp);
      await nextSearcher.search();

      nextSearcher = nextSearcher.pager();
      expectedPageParams.rows = ['10'];
      expectedPageParams.start = ['20'];
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedPageParams)).respond(200, fullSolrResp);
      await nextSearcher.search();

      nextSearcher = nextSearcher.pager();
      expect(nextSearcher).toBe(null);
    });

    it('accounts for custom rows count', async () => {
      var solrRespCustRows = structuredClone(fullSolrResp);
      solrRespCustRows.response.numFound = 61;

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, mockSolrParams, mockQueryText, { numberOfRows: 30 });

      var expectedPageParams = structuredClone(expectedParams);
      expectedPageParams.rows = ['30'];
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedPageParams)).respond(200, solrRespCustRows);
      await searcher.search();

      var nextSearcher = searcher.pager();
      expectedPageParams = structuredClone(expectedParams);
      expectedPageParams.rows = ['30'];
      expectedPageParams.start = ['30'];
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedPageParams)).respond(200, solrRespCustRows);
      await nextSearcher.search();

      nextSearcher = nextSearcher.pager();
      expectedPageParams.rows = ['30'];
      expectedPageParams.start = ['60'];
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedPageParams)).respond(200, solrRespCustRows);
      await nextSearcher.search();

      nextSearcher = nextSearcher.pager();
      expect(nextSearcher).toBe(null);
    });

    it('highlights new page', async () => {
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams)).respond(200, fullSolrResp);
      await searcher.search();

      var nextSearcher = searcher.pager();
      var expectedPageParams = structuredClone(expectedParams);
      expectedPageParams.rows = ['10'];
      expectedPageParams.start = ['10'];
      expectedPageParams.hl = ['true'];
      expectedPageParams['hl.simple.pre'] = [searchSvc.HIGHLIGHTING_PRE];
      expectedPageParams['hl.simple.post'] = [searchSvc.HIGHLIGHTING_POST];

      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedPageParams)).respond(200, fullSolrResp);
      await nextSearcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });
  });

  describe('explain other', () => {
    var mockSolrResp = {
      response: {
        numFound: 2,
        docs: [
          { id: 'doc1', title: 'title1' },
          { id: 'doc2', title: 'title2' }
        ]
      }
    };

    var explOtherDoc1 = { match: false, value: 0.0, description: 'no matching term' };
    var explOtherDoc2 = {
      match: true, value: 3.3733945,
      description: 'weight(catch_line:law in 4487) [DefaultSimilarity], result of:',
      details: [{
        match: true, value: 3.3733945,
        description: 'fieldWeight in 4487, product of:',
        details: [
          { match: true, value: 1.0, description: 'tf(freq=1.0), with freq of:', details: [{ match: true, value: 1.0, description: 'termFreq=1.0' }] },
          { match: true, value: 5.3974314, description: 'idf(docFreq=247, maxDocs=20148)' },
          { match: true, value: 0.625, description: 'fieldNorm(doc=4487)' }
        ]
      }]
    };

    var mockSolrExplOtherResp = {
      response: {
        numFound: 2,
        docs: [
          { id: 'not_doc1', title: 'title1' },
          { id: 'not_doc2', title: 'title2' }
        ]
      },
      debug: {
        explainOther: {
          doc1: explOtherDoc1,
          doc2: explOtherDoc2
        }
      }
    };

    it('passes two solr queries one explains the other', async () => {
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, mockSolrParams, mockQueryText);

      var expectedExplOtherParams = { explainOther: ['title:doc1'] };

      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedExplOtherParams))
        .respond(200, mockSolrExplOtherResp);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, { q: ['title:doc1'] }))
        .respond(200, mockSolrResp);

      await searcher.explainOther('title:doc1', mockFieldSpec);

      expect(searcher.docs.length).toBe(2);
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('highlights explain other', async () => {
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, mockSolrParams, mockQueryText);

      var expectedExplOtherParams = { explainOther: ['title:doc1'] };

      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedExplOtherParams))
        .respond(200, mockSolrExplOtherResp);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, {
        q: ['title:doc1'],
        hl: ['true'],
        'hl.simple.pre': [searchSvc.HIGHLIGHTING_PRE],
        'hl.simple.post': [searchSvc.HIGHLIGHTING_POST]
      })).respond(200, mockSolrResp);

      await searcher.explainOther('title:doc1', mockFieldSpec);

      expect(searcher.docs.length).toBe(2);
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('does not throw an error if both queries are empty', async () => {
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, mockSolrParams, '');

      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl)).respond(200, mockSolrExplOtherResp);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl)).respond(200, mockSolrResp);

      await searcher.explainOther('', mockFieldSpec);

      expect(searcher.docs.length).toBe(2);
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('paginates for explain other searches', async () => {
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockSolrUrl, mockSolrParams, mockQueryText);
      searcher.numFound = 100;
      searcher = searcher.pager();

      var expectedExplOtherParams = { explainOther: ['title:doc1'] };

      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedExplOtherParams))
        .respond(200, mockSolrExplOtherResp);
      mockBackend.expectJSONP(urlContainsParams(mockSolrUrl, { q: ['title:doc1'], start: ['10'], rows: ['10'] }))
        .respond(200, mockSolrResp);

      await searcher.explainOther('title:doc1', mockFieldSpec);

      expect(searcher.docs.length).toBe(2);
      mockBackend.verifyNoOutstandingExpectation();
    });
  });
});

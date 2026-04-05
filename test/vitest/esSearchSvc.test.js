import { describe, it, expect, beforeEach } from 'vitest';
import { createFetchClient } from '../../services/httpClient.js';
import { MockHttpBackend } from './helpers/mockHttpBackend.js';
import { getSearchSvc, getFieldSpecSvc, getEsUrlSvc } from './helpers/serviceFactory.js';

describe('searchSvc: ElasticSearch', () => {
  var searchSvc;
  var esUrlSvc;
  var fieldSpecSvc;
  var mockBackend;
  var searcher;
  var mockEsUrl = 'http://localhost:9200/statedecoded/_search';
  var mockFieldSpec = null;
  var mockQueryText = 'elastic';
  var mockEsParams = {
    query: { term: { text: '#$query##' } }
  };

  function rowsValidator(expectedParams) {
    return {
      test: function(data) {
        var parsed = JSON.parse(data);
        return parsed.size === expectedParams.size;
      }
    };
  }

  beforeEach(() => {
    mockBackend = new MockHttpBackend();
    var httpClient = createFetchClient({
      fetch: mockBackend.fetch,
      jsonpRequest: mockBackend.jsonpRequest,
    });
    searchSvc = getSearchSvc(httpClient);
    fieldSpecSvc = getFieldSpecSvc();
    esUrlSvc = getEsUrlSvc();
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1');
  });

  var mockES7Results = {
    hits: {
      total: { value: 2, relation: 'eq' },
      max_score: 1.0,
      hits: [
        {
          _index: 'statedecoded', _type: 'law', _id: 'l_1', _score: 5.0,
          _source: { field: ['1--field value'], field1: ['1--field1 value'] },
        },
        {
          _index: 'statedecoded', _type: 'law', _id: 'l_1', _score: 3.0,
          _source: { field: ['2--field value'], field1: ['2--field1 value'] }
        }
      ]
    }
  };

  describe('basic search', () => {
    describe('version 7+', () => {
      beforeEach(() => {
        searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, {}, 'es');
      });

      it('passes the rows param and sets it to 10 by default', async () => {
        mockBackend.expectPOST(mockEsUrl, rowsValidator({ size: 10 })).respond(200, mockES7Results);
        await searcher.search();
      });

      it('passes the rows param and sets it to what is passed in the config', async () => {
        searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, { numberOfRows: 20 }, 'es');
        mockBackend.expectPOST(mockEsUrl, rowsValidator({ size: 20 })).respond(200, mockES7Results);
        await searcher.search();
      });

      it('accesses es with mock es params', async () => {
        mockBackend.expectPOST(mockEsUrl, function(data) {
          var esQuery = JSON.parse(data);
          return esQuery.query.term.text === mockQueryText;
        }).respond(200, mockES7Results);
        await searcher.search();
        mockBackend.verifyNoOutstandingExpectation();
      });

      it('returns docs', async () => {
        mockBackend.expectPOST(mockEsUrl).respond(200, mockES7Results);
        var called = 0;
        await searcher.search().then(function() {
          var docs = searcher.docs;
          expect(docs.length).toEqual(2);
          var firstHit = mockES7Results.hits.hits[0];
          var secondHit = mockES7Results.hits.hits[1];
          expect(docs[0].field).toEqual(firstHit._source.field[0]);
          expect(docs[0].field1).toEqual(firstHit._source.field1[0]);
          expect(docs[1].field).toEqual(secondHit._source.field[0]);
          expect(docs[1].field1).toEqual(secondHit._source.field1[0]);
          called++;
        });
        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toEqual(1);
      });

      it('source has no "doc" or "field" property', async () => {
        mockBackend.expectPOST(mockEsUrl).respond(200, mockES7Results);
        var called = 0;
        await searcher.search().then(function() {
          var docs = searcher.docs;
          expect(docs[0].origin().doc).toBe(undefined);
          expect(docs[0].origin().fields).toBe(undefined);
          called++;
        });
        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toEqual(1);
      });

      it('reports pretty printed errors for ES errors but HTTP success', async () => {
        var errorMsg = { hits: [], _shards: { failed: 1, failures: [{ foo: 'your query just plain stunk' }] } };
        mockBackend.expectPOST(mockEsUrl).respond(200, errorMsg);
        var errorCalled = 0;
        await searcher.search().then(function() { errorCalled--; }, function(msg) {
          expect(msg.searchError.indexOf('HTTP')).toBe(-1);
          expect(msg.searchError.indexOf('200')).toBe(-1);
          expect(msg.searchError.indexOf('foo')).toBeGreaterThan(-1);
          expect(msg.searchError.indexOf('your query just plain stunk')).toBeGreaterThan(-1);
          errorCalled++;
        });
        mockBackend.verifyNoOutstandingExpectation();
        expect(errorCalled).toEqual(1);
      });

      it('reports pretty printed errors for HTTP errors', async () => {
        var errorMsg = { someMsg: 'your query just plain stunk' };
        mockBackend.expectPOST(mockEsUrl).respond(400, { error: errorMsg });
        var errorCalled = 0;
        await searcher.search().then(function() { errorCalled--; }, function(msg) {
          expect(msg.searchError.indexOf('HTTP')).toBeGreaterThan(-1);
          expect(msg.searchError.indexOf('400')).toBeGreaterThan(-1);
          expect(msg.searchError.indexOf('someMsg')).toBeGreaterThan(-1);
          expect(msg.searchError.indexOf('your query just plain stunk')).toBeGreaterThan(-1);
          errorCalled++;
        });
        mockBackend.verifyNoOutstandingExpectation();
        expect(errorCalled).toEqual(1);
      });

      it('network or CORS error', async () => {
        mockBackend.expectPOST(mockEsUrl).respond(-1);
        var errorCalled = 0;
        await searcher.search().then(function() { errorCalled--; }, function(msg) {
          expect(msg.searchError.indexOf('Network Error')).toBeGreaterThan(-1);
          expect(msg.searchError.indexOf('CORS')).toBeGreaterThan(-1);
          errorCalled++;
        });
        mockBackend.verifyNoOutstandingExpectation();
        expect(errorCalled).toEqual(1);
      });

      it('sets the proper headers for auth', async () => {
        var authEsUrl = 'http://username:password@localhost:9200/statedecoded/_search';
        searcher = searchSvc.createSearcher(mockFieldSpec, authEsUrl, mockEsParams, mockQueryText, {}, 'es');
        var targetUrl = esUrlSvc.buildUrl(esUrlSvc.parseUrl(authEsUrl));
        mockBackend.expectPOST(targetUrl, undefined, function(headers) {
          return headers.Authorization == 'Basic ' + btoa('username:password');
        }).respond(200, mockES7Results);

        var called = 0;
        await searcher.search().then(function() {
          var docs = searcher.docs;
          expect(docs.length).toEqual(2);
          var firstHit = mockES7Results.hits.hits[0];
          var secondHit = mockES7Results.hits.hits[1];
          expect(docs[0].field).toEqual(firstHit._source.field[0]);
          expect(docs[0].field1).toEqual(firstHit._source.field1[0]);
          expect(docs[1].field).toEqual(secondHit._source.field[0]);
          expect(docs[1].field1).toEqual(secondHit._source.field1[0]);
          called++;
        });
        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toEqual(1);
      });
    });
  });

  describe('explain info', () => {
    beforeEach(() => {
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, {}, 'es');
    });

    var basicExplain1 = { match: true, value: 1.5, description: 'weight(text:law in 1234)', details: [] };
    var basicExplain2 = { match: true, value: 0.5, description: 'weight(text:order in 1234)', details: [] };
    var sumExplain = { match: true, value: 1.0, description: 'sum of', details: [basicExplain1, basicExplain2] };

    it('asks for explain', async () => {
      mockBackend.expectPOST(mockEsUrl, function(data) {
        var esQuery = JSON.parse(data);
        return Object.hasOwn(esQuery, 'explain') && esQuery.explain === true;
      }).respond(200, mockES7Results);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('it populates explain', async () => {
      var mockES7ResultsWithExpl = structuredClone(mockES7Results);
      mockES7ResultsWithExpl.hits.hits[0]._explanation = sumExplain;
      var called = 0;
      mockBackend.expectPOST(mockEsUrl).respond(200, mockES7ResultsWithExpl);
      await searcher.search().then(function() {
        var docs = searcher.docs;
        expect(docs[0].explain()).toEqual(sumExplain);
        expect(docs[1].explain()).toBe(null);
        called++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });

    it('source has no _explanation', async () => {
      var mockES7ResultsWithExpl = structuredClone(mockES7Results);
      mockES7ResultsWithExpl.hits.hits[0]._explanation = sumExplain;
      var called = 0;
      mockBackend.expectPOST(mockEsUrl).respond(200, mockES7ResultsWithExpl);
      await searcher.search().then(function() {
        var docs = searcher.docs;
        expect(docs[0].origin()._explanation).toBe(undefined);
        called++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });
  });

  describe('parsedQueryDetails info', () => {
    beforeEach(() => {
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, {}, 'es');
    });

    var mockProfile = {
      shards: [{
        id: '[2aE02wS1R8q_QFnYu6vDVQ][my-index-000001][0]',
        searches: [{ query: [{ type: 'BooleanQuery', description: 'message:get message:search', time_in_nanos: 11972972 }] }]
      }]
    };

    it('asks for profile', async () => {
      mockBackend.expectPOST(mockEsUrl, function(data) {
        var esQuery = JSON.parse(data);
        return Object.hasOwn(esQuery, 'profile') && esQuery.profile === true;
      }).respond(200, mockES7Results);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('it populates profile', async () => {
      var mockES7ResultsWithProfile = structuredClone(mockES7Results);
      mockES7ResultsWithProfile.profile = mockProfile;
      var called = 0;
      mockBackend.expectPOST(mockEsUrl).respond(200, mockES7ResultsWithProfile);
      await searcher.search().then(function() {
        var profile = searcher.parsedQueryDetails;
        expect(profile).toEqual(mockProfile);
        called++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });
  });

  describe('url', () => {
    var fullResponse;

    beforeEach(() => {
      mockFieldSpec = fieldSpecSvc.createFieldSpec('id:_id title');
      mockEsUrl = 'http://localhost:9200/tmdb/_search';
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, {}, 'es');

      fullResponse = {
        hits: {
          hits: [
            {
              _score: 6.738184, _type: 'movie', _id: 'AU8pXbemwjf9yCj9Xh4e',
              _source: { poster_path: '/nwCm80TFvA7pQAQdcGHs69ZeGOK.jpg', title: 'Rambo', id: 5039, name: 'Rambo Collection' },
              _index: 'tmdb',
              highlight: { title: ['<em>Rambo</em>'] }
            },
            {
              _score: 4.1909046, _type: 'movie', _id: 'AU8pXau9wjf9yCj9Xhug',
              _source: { poster_path: '/cUJgu5U6MHj9GF1weNtIPvN3IoS.jpg', id: 1370, title: 'Rambo III' },
              _index: 'tmdb'
            }
          ],
          total: 2, max_score: 6.738184
        },
        _shards: { successful: 5, failed: 0, total: 5 },
        took: 88, timed_out: false
      };
    });

    it('returns the proper url for the doc', async () => {
      mockBackend.expectPOST(mockEsUrl).respond(200, fullResponse);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        var docs = searcher.docs;
        var expectedUrl = 'http://localhost:9200/tmdb/movie/_doc/AU8pXbemwjf9yCj9Xh4e?pretty=true';
        expect(docs[0]._url()).toEqual(expectedUrl);
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });
  });

  describe('highlights', () => {
    var fullResponse;

    beforeEach(() => {
      mockFieldSpec = fieldSpecSvc.createFieldSpec('id:_id title');
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, { version: '2.0' }, 'es');

      fullResponse = {
        hits: {
          hits: [
            {
              _score: 6.738184, _type: 'movie', _id: 'AU8pXbemwjf9yCj9Xh4e',
              _source: { poster_path: '/nwCm80TFvA7pQAQdcGHs69ZeGOK.jpg', title: 'Rambo', id: 5039, name: 'Rambo Collection' },
              _index: 'tmdb',
              highlight: { title: ['<em>Rambo</em>'] }
            },
            {
              _score: 4.1909046, _type: 'movie', _id: 'AU8pXau9wjf9yCj9Xhug',
              _source: { poster_path: '/cUJgu5U6MHj9GF1weNtIPvN3IoS.jpg', id: 1370, title: 'Rambo III' },
              _index: 'tmdb'
            }
          ],
          total: 2, max_score: 6.738184
        },
        _shards: { successful: 5, failed: 0, total: 5 },
        took: 88, timed_out: false
      };
    });

    it('asks for highlighting by default', async () => {
      mockBackend.expectPOST(mockEsUrl, function(data) {
        var esQuery = JSON.parse(data);
        var expectedHighlight = { fields: { title: {} } };
        return Object.hasOwn(esQuery, 'highlight') &&
          JSON.stringify(esQuery.highlight) === JSON.stringify(expectedHighlight);
      }).respond(200, mockES7Results);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('specifies highlighting for specified fields', async () => {
      mockFieldSpec = fieldSpecSvc.createFieldSpec('id:_id title section tags');
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, { version: '2.0' }, 'es');

      mockBackend.expectPOST(mockEsUrl, function(data) {
        var esQuery = JSON.parse(data);
        var expectedHighlight = { fields: { title: {}, section: {}, tags: {} } };
        return Object.hasOwn(esQuery, 'highlight') &&
          JSON.stringify(esQuery.highlight) === JSON.stringify(expectedHighlight);
      }).respond(200, mockES7Results);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('does not override manual highlighting options', async () => {
      var expectedHighlight = { fields: { foo: {}, bar: {} } };
      var esParamsWithHl = structuredClone(mockEsParams);
      esParamsWithHl.highlight = expectedHighlight;

      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, esParamsWithHl, mockQueryText, {}, 'es');
      mockBackend.expectPOST(mockEsUrl, function(data) {
        var esQuery = JSON.parse(data);
        return Object.hasOwn(esQuery, 'highlight') &&
          JSON.stringify(esQuery.highlight) === JSON.stringify(expectedHighlight);
      }).respond(200, mockES7Results);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('gets highlight snippet field values if returned', async () => {
      mockBackend.expectPOST(mockEsUrl).respond(200, fullResponse);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        var docs = searcher.docs;
        expect(docs[0].snippet('AU8pXbemwjf9yCj9Xh4e', 'title')).toEqual(['<em>Rambo</em>']);
        expect(docs[0].highlight('AU8pXbemwjf9yCj9Xh4e', 'title', '<b>', '</b>')).toEqual(['<b>Rambo</b>']);
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('returns null if no highlights for field', async () => {
      mockBackend.expectPOST(mockEsUrl).respond(200, fullResponse);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        var docs = searcher.docs;
        expect(docs[0].snippet('AU8pXbemwjf9yCj9Xh4e', 'foo')).toEqual(null);
        expect(docs[0].highlight('AU8pXbemwjf9yCj9Xh4e', 'foo', '<b>', '</b>')).toEqual(null);
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('returns null if no highlights', async () => {
      mockBackend.expectPOST(mockEsUrl).respond(200, fullResponse);
      var called = 0;
      await searcher.search().then(function() {
        called++;
        var docs = searcher.docs;
        expect(docs[1].snippet('AU8pXbemwjf9yCj9Xh4e', 'foo')).toEqual(null);
        expect(docs[1].highlight('AU8pXbemwjf9yCj9Xh4e', 'foo', '<b>', '</b>')).toEqual(null);
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('source has no highlighting property', async () => {
      mockBackend.expectPOST(mockEsUrl).respond(200, fullResponse);
      var called = 0;
      await searcher.search().then(function() {
        var docs = searcher.docs;
        expect(docs[0].origin().highlight).toBe(undefined);
        called++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });
  });

  describe('vars', () => {
    it('replaces vars no URI encode', async () => {
      var qt = 'taco&burrito';
      var params = { query: { term: { text: '#$query##' } } };
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, params, qt, {}, 'es');
      mockBackend.expectPOST(mockEsUrl, function(data) {
        var esQuery = JSON.parse(data);
        return esQuery.query.term.text === qt;
      }).respond(200, mockES7Results);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('replaces keywords vars', async () => {
      var qt = 'taco&burrito purina headphone';
      var params = { query: { term: { text: '#$keyword1## #$query## #$keyword2##' } } };
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, params, qt, {}, 'es');
      mockBackend.expectPOST(mockEsUrl, function(data) {
        var esQuery = JSON.parse(data);
        return esQuery.query.term.text === 'taco&burrito taco&burrito purina headphone purina';
      }).respond(200, mockES7Results);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('null queryText', async () => {
      var params = { query: { term: { text: 'lovely bunnies' } } };
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, params, null, {}, 'es');
      mockBackend.expectPOST(mockEsUrl, function(data) {
        var esQuery = JSON.parse(data);
        return esQuery.query.term.text === 'lovely bunnies';
      }).respond(200, mockES7Results);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('empty query placeholder turns to empty string', async () => {
      var qt = 'purina headphone';
      var params = { query: { term: { text: '#$keyword1## #$keyword3##' } } };
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, params, qt, {}, 'es');
      mockBackend.expectPOST(mockEsUrl, function(data) {
        var esQuery = JSON.parse(data);
        return esQuery.query.term.text === 'purina ';
      }).respond(200, mockES7Results);
      await searcher.search();
      mockBackend.verifyNoOutstandingExpectation();
    });
  });

  describe('paging', () => {
    var fullResponse = {
      hits: {
        hits: [
          { _score: 6.738184, _type: 'movie', _id: 'AU8pXbemwjf9yCj9Xh4e', _source: { poster_path: '/nwCm80TFvA7pQAQdcGHs69ZeGOK.jpg', title: 'Rambo', id: 5039, name: 'Rambo Collection' }, _index: 'tmdb', highlight: { title: ['<em>Rambo</em>'] } },
          { _score: 4.1909046, _type: 'movie', _id: 'AU8pXau9wjf9yCj9Xhug', _source: { poster_path: '/cUJgu5U6MHj9GF1weNtIPvN3IoS.jpg', id: 1370, title: 'Rambo III' }, _index: 'tmdb' }
        ],
        total: 30, max_score: 6.738184
      },
      _shards: { successful: 5, failed: 0, total: 5 }, took: 88, timed_out: false
    };

    function pagerValidator(expectedPagerParams) {
      return {
        test: function(data) {
          var parsed = JSON.parse(data);
          return parsed.from === expectedPagerParams.from && parsed.size === expectedPagerParams.size;
        }
      };
    }

    beforeEach(() => {
      mockFieldSpec = fieldSpecSvc.createFieldSpec('id:_id title');
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, {}, 'es');
    });

    it('pages on page', async () => {
      mockBackend.expectPOST(mockEsUrl).respond(200, fullResponse);
      await searcher.search();

      var nextSearcher = searcher.pager();
      mockBackend.expectPOST(mockEsUrl, pagerValidator({ size: 10, from: 10 })).respond(200, fullResponse);
      await nextSearcher.search();

      nextSearcher = nextSearcher.pager();
      mockBackend.expectPOST(mockEsUrl, pagerValidator({ size: 10, from: 20 })).respond(200, fullResponse);
      await nextSearcher.search();

      nextSearcher = nextSearcher.pager();
      expect(nextSearcher).toBe(null);
    });

    it('accounts for custom rows count', async () => {
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, { numberOfRows: 20 }, 'es');
      mockBackend.expectPOST(mockEsUrl).respond(200, fullResponse);
      await searcher.search();

      var nextSearcher = searcher.pager();
      mockBackend.expectPOST(mockEsUrl, pagerValidator({ size: 20, from: 20 })).respond(200, fullResponse);
      await nextSearcher.search();

      nextSearcher = nextSearcher.pager();
      expect(nextSearcher).toBe(null);
    });
  });

  describe('failures', () => {
    beforeEach(() => {
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, {}, 'es');
    });

    it('reports failures', async () => {
      var failureResponse = {
        _shards: {
          total: 2, successful: 1, failed: 1,
          failures: [{ index: 'statedecoded', shard: 1, status: 400, reason: "ElasticsearchIllegalArgumentException[field [cast] isn't a leaf field]" }]
        },
        hits: { total: 2, max_score: 1.0, hits: [] }
      };
      mockBackend.expectPOST(mockEsUrl).respond(200, failureResponse);
      var errorCalled = 0;
      await searcher.search().then(function() { errorCalled--; }, function(msg) {
        expect(msg.searchError).toContain("ElasticsearchIllegalArgumentException[field [cast] isn't a leaf field]");
        errorCalled++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(errorCalled).toEqual(1);
    });
  });

  describe('explain other', () => {
    beforeEach(() => {
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, { version: '2.0' }, 'es');
    });

    var basicExplain1 = { value: 1.5, description: 'weight(text:law in 1234)' };
    var basicExplain2 = { value: 0.5, description: 'weight(text:order in 1234)' };
    var sumExplain = {
      matched: true,
      explanation: { value: 1.5, description: 'weight(_all:law in 1234)', details: [basicExplain1, basicExplain2] }
    };
    var otherQuery = 'message:foo';

    var expectedDocs = [
      { _index: 'statedecoded', _type: 'law', _id: 'l_1', _score: 5.0, fields: { field: ['1--field value'], field1: ['1--field1 value'] } },
      { _index: 'statedecoded', _type: 'law', _id: 'l_1', _score: 3.0, fields: { field: ['2--field value'], field1: ['2--field1 value'] } }
    ];
    var expectedResponse = { hits: { total: 2, max_score: 1.0, hits: expectedDocs } };
    var expectedExplainResponse = sumExplain;

    it('makes one search request and one explain request per resulting doc', async () => {
      mockBackend.expectPOST(mockEsUrl).respond(200, expectedResponse);
      expectedDocs.forEach(function(doc) {
        var explainUrl = 'http://localhost:9200/statedecoded/_explain/' + doc._id;
        mockBackend.expectPOST(explainUrl).respond(200, expectedExplainResponse);
      });
      await searcher.explainOther(otherQuery, mockFieldSpec);
      mockBackend.verifyNoOutstandingExpectation();
    });

    it('sets the array of docs', async () => {
      mockBackend.expectPOST(mockEsUrl).respond(200, expectedResponse);
      expectedDocs.forEach(function(doc) {
        var explainUrl = 'http://localhost:9200/statedecoded/_explain/' + doc._id;
        mockBackend.expectPOST(explainUrl).respond(200, expectedExplainResponse);
      });
      var called = 0;
      await searcher.explainOther(otherQuery, mockFieldSpec).then(function() {
        expect(searcher.numFound).toBe(2);
        expect(searcher.docs.length).toBe(2);
        called++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it('paginates for explain other searches', async () => {
      mockBackend.expectPOST(mockEsUrl).respond(200, expectedResponse);
      expectedDocs.forEach(function(doc) {
        var explainUrl = 'http://localhost:9200/statedecoded/_explain/' + doc._id;
        mockBackend.expectPOST(explainUrl).respond(200, expectedExplainResponse);
      });
      searcher.numFound = 100;
      searcher = searcher.pager();
      await searcher.explainOther(otherQuery, mockFieldSpec);
      mockBackend.verifyNoOutstandingExpectation();
    });
  });

  describe('version', () => {
    beforeEach(() => {
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, {}, 'es');
    });

    it('defaults to version 5.0 and uses the "_source" params', async () => {
      expect(searcher.config.version).toEqual('5.0');
      mockBackend.expectPOST(mockEsUrl, function(postData) {
        var jsonData = JSON.parse(postData);
        expect(jsonData._source).toEqual(mockFieldSpec.fieldList());
        return true;
      }).respond(200, mockES7Results);
      await searcher.search();
    });
  });

  describe('version 7', () => {
    beforeEach(() => {
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, {}, 'es');
    });

    it('returns docs, and maps the hits.total.value to the numFound', async () => {
      mockBackend.expectPOST(mockEsUrl).respond(200, mockES7Results);
      var called = 0;
      await searcher.search().then(function() {
        expect(searcher.docs.length).toEqual(2);
        expect(searcher.numFound).toEqual(2);
        called++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });
  });

  describe('templated search', () => {
    beforeEach(() => {
      var templateParams = {
        id: 'tmdb-title-search-template',
        params: { search_query: 'star' }
      };
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, templateParams, mockQueryText, {}, 'es');
    });

    it('returns docs, and removes _source and highlight query params', async () => {
      mockBackend.expectPOST(mockEsUrl + '/template', function(data) {
        var esQuery = JSON.parse(data);
        return esQuery.id === 'tmdb-title-search-template' &&
          esQuery.highlight === undefined &&
          esQuery._source === undefined &&
          esQuery.from === undefined &&
          esQuery.size === undefined &&
          esQuery.params.from === 0 &&
          esQuery.params.size === 10;
      }).respond(200, mockES7Results);

      var called = 0;
      await searcher.search().then(function() {
        expect(searcher.docs.length).toEqual(2);
        expect(searcher.numFound).toEqual(2);
        called++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });
  });

  describe('templated and proxied search', () => {
    beforeEach(() => {
      var templateParams = {
        id: 'tmdb-title-search-template',
        params: { search_query: 'star' }
      };
      var config = { apiMethod: 'POST', proxyUrl: 'http://myserver/api?url=' };
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, templateParams, mockQueryText, config, 'es');
    });

    it('returns docs, and removes _source and highlight query params', async () => {
      mockBackend.expectPOST('http://myserver/api?url=' + mockEsUrl + '/template', function(data) {
        var esQuery = JSON.parse(data);
        return esQuery.id === 'tmdb-title-search-template' &&
          esQuery.highlight === undefined &&
          esQuery._source === undefined &&
          esQuery.from === undefined &&
          esQuery.size === undefined &&
          esQuery.params.from === 0 &&
          esQuery.params.size === 10;
      }).respond(200, mockES7Results);

      var called = 0;
      await searcher.search().then(function() {
        expect(searcher.docs.length).toEqual(2);
        expect(searcher.numFound).toEqual(2);
        called++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });
  });

  describe('scripted fields', () => {
    var mockScriptedResults = {
      hits: {
        total: { value: 2, relation: 'eq' }, max_score: 1.0,
        hits: [
          { _index: 'statedecoded', _type: 'law', _id: 'l_1', _score: 5.0, _source: { vote_avg_times_two: [15.399999618530273] } },
          { _index: 'statedecoded', _type: 'law', _id: 'l_1', _score: 3.0, _source: { vote_avg_times_two: [10.800000190734863] } }
        ]
      }
    };

    beforeEach(() => {
      mockFieldSpec = fieldSpecSvc.createFieldSpec('id:_id title vote_avg_times_two');
      var scriptedParams = {
        query: { match: { title: '#$query##' } },
        script_fields: { vote_avg_times_two: { script: { lang: 'painless', source: "doc['vote_average'].value * 2" } } }
      };
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, scriptedParams, mockQueryText, {}, 'es');
    });

    it('returns docs, with the scripted fields as a property on the doc', async () => {
      mockBackend.expectPOST(mockEsUrl).respond(200, mockScriptedResults);
      var called = 0;
      await searcher.search().then(function() {
        var docs = searcher.docs;
        expect(docs.length).toEqual(2);
        expect(searcher.numFound).toEqual(2);
        expect(docs[0].vote_avg_times_two).toEqual(15.399999618530273);
        expect(docs[1].vote_avg_times_two).toEqual(10.800000190734863);
        called++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });
  });

  describe('rendering templates', () => {
    var mockTemplateResults = {
      template_output: {
        query: { match: { title: 'star' } },
        from: '0', size: '1',
        _source: ['id', 'title', 'poster_path']
      }
    };

    beforeEach(() => {
      mockFieldSpec = fieldSpecSvc.createFieldSpec('id:_id title vote_avg_times_two');
      var templateQueryParams = {
        id: 'tmdb-title-search-template',
        params: { search_query: 'star', from: 0, size: 2 }
      };
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, templateQueryParams, mockQueryText, {}, 'es');
    });

    it('returns the rendered template showing the underlying query to be issued', async () => {
      mockBackend.expectPOST('http://localhost:9200/_render/template').respond(200, mockTemplateResults);
      var called = 0;
      await searcher.renderTemplate().then(function() {
        var renderedTemplateJson = searcher.renderedTemplateJson;
        expect(renderedTemplateJson.template_output.query.match.title).toEqual('star');
        expect(renderedTemplateJson).toEqual(mockTemplateResults);
        called++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });

    it('rejects with formatted error on HTTP error', async () => {
      mockBackend.expectPOST('http://localhost:9200/_render/template')
        .respond(400, { error: { reason: 'bad template syntax' } });
      var errorCalled = 0;
      await searcher.renderTemplate().then(function() { errorCalled--; }, function(msg) {
        expect(msg.searchError).toContain('HTTP Error');
        expect(msg.searchError).toContain('400');
        expect(msg.searchError).toContain('bad template syntax');
        expect(searcher.inError).toBe(true);
        errorCalled++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(errorCalled).toEqual(1);
    });

    it('rejects with network/CORS error on status -1', async () => {
      mockBackend.expectPOST('http://localhost:9200/_render/template').respond(-1);
      var errorCalled = 0;
      await searcher.renderTemplate().then(function() { errorCalled--; }, function(msg) {
        expect(msg.searchError).toContain('Network Error');
        expect(msg.searchError).toContain('CORS');
        expect(searcher.inError).toBe(true);
        errorCalled++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(errorCalled).toEqual(1);
    });

    it('rejects with shard failure details on partial failure', async () => {
      var shardFailureResponse = {
        error: { reason: 'shard error' },
        _shards: { failed: 1, failures: [{ reason: 'template compilation failed' }] }
      };
      mockBackend.expectPOST('http://localhost:9200/_render/template').respond(500, shardFailureResponse);
      var errorCalled = 0;
      await searcher.renderTemplate().then(function() { errorCalled--; }, function(msg) {
        expect(msg.searchError).toContain('template compilation failed');
        expect(searcher.inError).toBe(true);
        errorCalled++;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(errorCalled).toEqual(1);
    });
  });

  describe('explainOther error handling', () => {
    beforeEach(() => {
      searcher = searchSvc.createSearcher(mockFieldSpec, mockEsUrl, mockEsParams, mockQueryText, { version: '2.0' }, 'es');
    });

    it('handles search failure in explainOther gracefully', async () => {
      var otherQuery = 'message:foo';
      mockBackend.expectPOST(mockEsUrl).respond(500, { error: 'Internal Server Error' });
      var called = 0;
      await searcher.explainOther(otherQuery, mockFieldSpec).catch(function() { called++; });
      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });
  });
});

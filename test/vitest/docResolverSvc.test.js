import { describe, it, expect, beforeEach } from 'vitest';
import { createFetchClient } from '../../services/httpClient.js';
import { MockHttpBackend } from './helpers/mockHttpBackend.js';
import { urlContainsParams } from './helpers/mockHelpers.js';
import { addExplain } from './helpers/mockData.js';
import { getDocResolverSvc, getFieldSpecSvc } from './helpers/serviceFactory.js';
import { activeQueries } from '../../values/activeQueries.js';

describe('docResolverSvc', () => {
  var docResolverSvc;
  var mockBackend;
  var mockFieldSpec;

  beforeEach(() => {
    mockBackend = new MockHttpBackend();
    var httpClient = createFetchClient({
      fetch: mockBackend.fetch,
      jsonpRequest: mockBackend.jsonpRequest,
    });
    docResolverSvc = getDocResolverSvc(httpClient);
    mockFieldSpec = getFieldSpecSvc().createFieldSpec('field field1');
  });

  describe('Solr', () => {
    var mockSolrUrl = 'http://example.com:1234/collection1/select';

    var mockTry = {
      args: {
        q: ['#$query##'],
      },
      tryNo: 2,
    };

    var mockSolrResp = {
      response: {
        numFound: 10,
        docs: [
          { id: 'doc1', field1: 'title1' },
          { id: 'doc2', field1: 'title2' },
          { id: 'doc3', field1: 'title3' },
          { id: 'doc4', field1: 'title4' },
          { id: 'doc5', field1: 'title5' },
          { id: 'doc6', field1: 'title6' },
          { id: 'doc7', field1: 'title7' },
          { id: 'doc8', field1: 'title8' },
          { id: 'doc9', field1: 'title9' },
          { id: 'doc10', field1: 'title10' },
        ],
      },
    };
    addExplain(mockSolrResp);

    var mockSolrRespMissingDoc2 = {
      response: {
        numFound: 10,
        docs: [
          { id: 'doc1', field1: 'title1' },
          { id: 'doc3', field1: 'title3' },
          { id: 'doc4', field1: 'title4' },
          { id: 'doc5', field1: 'title5' },
          { id: 'doc6', field1: 'title6' },
          { id: 'doc7', field1: 'title7' },
          { id: 'doc8', field1: 'title8' },
          { id: 'doc9', field1: 'title9' },
          { id: 'doc10', field1: 'title10' },
        ],
      },
    };
    addExplain(mockSolrResp);

    var mockSettings;

    beforeEach(() => {
      mockSettings = {
        selectedTry: mockTry,
        createFieldSpec: function () {
          return mockFieldSpec;
        },
        searchUrl: mockSolrUrl,
      };
    });

    it('resolves docs by querying solr with ids', async () => {
      var resolver = docResolverSvc.createResolver(['doc1', 'doc2'], mockSettings);
      var expectedUrlParams = {
        q: [encodeURIComponent('id:(doc1 OR doc2)')],
      };
      mockBackend
        .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
        .respond(200, mockSolrResp);

      await resolver.fetchDocs().then(function () {
        expect(resolver.docs.length).toBe(2);
        var ids = [];
        resolver.docs.forEach(function (doc) {
          ids.push(doc.id);
        });
        expect(ids).toContain('doc2');
        expect(ids).toContain('doc1');
      });

      mockBackend.verifyNoOutstandingExpectation();
    });

    it('stubs out missing docs', async () => {
      var resolver = docResolverSvc.createResolver(['doc1', 'doc2', 'doc3'], mockSettings);
      var expectedUrlParams = {
        q: [encodeURIComponent('id:(doc1 OR doc2 OR doc3)')],
      };

      mockBackend
        .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
        .respond(200, mockSolrRespMissingDoc2);

      await resolver.fetchDocs().then(function () {
        expect(resolver.docs.length).toBe(3);
        var ids = [];
        resolver.docs.forEach(function (doc) {
          ids.push(doc.id);
        });
        expect(ids).toContain('doc3');
        expect(ids).toContain('doc2');
        expect(ids).toContain('doc1');
      });

      mockBackend.verifyNoOutstandingExpectation();
    });

    // Escaping behavior disabled pending SUSS_USE_OF_ESCAPING product decision.
    describe('escape solr chars testing', () => {
      var mockSolrEscResp = {
        response: {
          numFound: 20,
          docs: [
            { id: 'http://doc1', field1: 'title1' },
            { id: 'http://doc2', field1: 'title2' },
          ],
        },
      };
      var escDocs = null;
      var resolver = null;
      beforeEach(() => {
        escDocs = ['http://doc1', 'http://doc2'];
        resolver = docResolverSvc.createResolver(escDocs, mockSettings);
      });

      it.skip('solr escapes before sending', async () => {
        var expectedUrlParams = {
          q: [encodeURIComponent('id:(http\\://doc1 OR http\\://doc2)')],
        };
        mockBackend
          .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
          .respond(200, mockSolrEscResp);
        await resolver.fetchDocs();
        mockBackend.verifyNoOutstandingExpectation();
      });
    });

    describe('big resp testing', () => {
      var mockSolrBigResp = {
        response: {
          numFound: 20,
          docs: [
            { id: 'doc1', field1: 'title1' },
            { id: 'doc2', field1: 'title2' },
            { id: 'doc3', field1: 'title3' },
            { id: 'doc4', field1: 'title4' },
            { id: 'doc5', field1: 'title5' },
            { id: 'doc6', field1: 'title6' },
            { id: 'doc7', field1: 'title7' },
            { id: 'doc8', field1: 'title8' },
            { id: 'doc9', field1: 'title9' },
            { id: 'doc10', field1: 'title10' },
            { id: 'doc11', field1: 'title11' },
            { id: 'doc12', field1: 'title12' },
            { id: 'doc13', field1: 'title13' },
            { id: 'doc14', field1: 'title14' },
            { id: 'doc15', field1: 'title15' },
            { id: 'doc16', field1: 'title16' },
            { id: 'doc17', field1: 'title17' },
            { id: 'doc18', field1: 'title18' },
            { id: 'doc19', field1: 'title19' },
            { id: 'doc20', field1: 'title20' },
          ],
        },
      };
      addExplain(mockSolrBigResp);

      var resolver = null;
      var lotsOfDocs = [];

      beforeEach(() => {
        lotsOfDocs = [
          'doc1',
          'doc2',
          'doc3',
          'doc4',
          'doc5',
          'doc6',
          'doc7',
          'doc8',
          'doc9',
          'doc10',
          'doc11',
          'doc12',
          'doc13',
          'doc14',
          'doc15',
          'doc16',
          'doc17',
          'doc18',
          'doc19',
          'doc20',
        ];
        resolver = docResolverSvc.createResolver(lotsOfDocs, mockSettings);
      });

      it('puts all 20 docs in q', async () => {
        var expectedUrlParams = {
          q: [
            encodeURIComponent(
              'id:(doc1 OR doc2 OR doc3 OR doc4 OR doc5 OR doc6 OR doc7 OR doc8 OR doc9 OR doc10 OR doc11 OR doc12 OR doc13 OR doc14 OR doc15 OR doc16 OR doc17 OR doc18 OR doc19 OR doc20)',
            ),
          ],
        };
        mockBackend
          .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
          .respond(200, mockSolrBigResp);
        await resolver.fetchDocs();
        mockBackend.verifyNoOutstandingExpectation();
      });

      it('sets rows=docs.length', async () => {
        var expectedUrlParams = {
          rows: [encodeURIComponent('' + lotsOfDocs.length)],
        };
        mockBackend
          .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
          .respond(200, mockSolrBigResp);
        await resolver.fetchDocs();
        mockBackend.verifyNoOutstandingExpectation();
      });

      it('gets all docs.length docs', async () => {
        var expectedUrlParams = {
          q: [
            encodeURIComponent(
              'id:(doc1 OR doc2 OR doc3 OR doc4 OR doc5 OR doc6 OR doc7 OR doc8 OR doc9 OR doc10 OR doc11 OR doc12 OR doc13 OR doc14 OR doc15 OR doc16 OR doc17 OR doc18 OR doc19 OR doc20)',
            ),
          ],
        };
        mockBackend
          .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
          .respond(200, mockSolrBigResp);
        await resolver.fetchDocs().then(function () {
          expect(resolver.docs.length).toBe(lotsOfDocs.length);
        });
        mockBackend.verifyNoOutstandingExpectation();
      });

      it('gets all docs.length docs & values', async () => {
        var expectedUrlParams = {
          q: [
            encodeURIComponent(
              'id:(doc1 OR doc2 OR doc3 OR doc4 OR doc5 OR doc6 OR doc7 OR doc8 OR doc9 OR doc10 OR doc11 OR doc12 OR doc13 OR doc14 OR doc15 OR doc16 OR doc17 OR doc18 OR doc19 OR doc20)',
            ),
          ],
        };
        mockBackend
          .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
          .respond(200, mockSolrBigResp);
        await resolver.fetchDocs().then(function () {
          var ids = [];
          resolver.docs.forEach(function (doc) {
            ids.push(doc.id);
          });
          lotsOfDocs.forEach(function (docId) {
            expect(ids).toContain(docId);
          });
        });
      });
    });

    describe('chunked queries', () => {
      var docList = [
        { id: 'doc1', field1: 'title1' },
        { id: 'doc2', field1: 'title2' },
        { id: 'doc3', field1: 'title3' },
        { id: 'doc4', field1: 'title4' },
      ];

      var makeSolrResp = function (docs) {
        return {
          response: {
            numFound: 20,
            docs: docs,
          },
        };
      };

      var mockChunk1_2 = makeSolrResp(docList.slice(0, 2));
      var mockChunk2_2 = makeSolrResp(docList.slice(2, 4));

      var mockChunk1_4 = makeSolrResp(docList.slice(0, 1));
      var mockChunk2_4 = makeSolrResp(docList.slice(1, 2));
      var mockChunk3_4 = makeSolrResp(docList.slice(2, 3));
      var mockChunk4_4 = makeSolrResp(docList.slice(3, 4));

      var mockChunk1_1 = makeSolrResp(docList);

      var resolver = null;
      var docIds = [];

      beforeEach(() => {
        docIds = ['doc1', 'doc2', 'doc3', 'doc4'];
      });

      var expectAllDocsPresent = function (resolver) {
        var ids = [];
        resolver.docs.forEach(function (doc) {
          ids.push(doc.id);
        });
        expect(ids).toContain('doc1');
        expect(ids).toContain('doc2');
        expect(ids).toContain('doc3');
        expect(ids).toContain('doc4');
        expect(ids.length).toEqual(4);
      };

      it('resolves in single chunks', async () => {
        resolver = docResolverSvc.createResolver(docIds, mockSettings, 1);
        var expectedUrlParamsChunk1 = { q: [encodeURIComponent('id:(doc1)')] };
        var expectedUrlParamsChunk2 = { q: [encodeURIComponent('id:(doc2)')] };
        var expectedUrlParamsChunk3 = { q: [encodeURIComponent('id:(doc3)')] };
        var expectedUrlParamsChunk4 = { q: [encodeURIComponent('id:(doc4)')] };

        mockBackend
          .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk1))
          .respond(200, mockChunk1_4);
        mockBackend
          .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk2))
          .respond(200, mockChunk2_4);
        mockBackend
          .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk3))
          .respond(200, mockChunk3_4);
        mockBackend
          .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk4))
          .respond(200, mockChunk4_4);
        var called = 0;

        await resolver.fetchDocs().then(function () {
          called++;
          expectAllDocsPresent(resolver);
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it('resolves in two chunks', async () => {
        resolver = docResolverSvc.createResolver(docIds, mockSettings, 2);
        var expectedUrlParamsChunk1 = { q: [encodeURIComponent('id:(doc1 OR doc2)')] };
        var expectedUrlParamsChunk2 = { q: [encodeURIComponent('id:(doc3 OR doc4)')] };
        mockBackend
          .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk1))
          .respond(200, mockChunk1_2);
        mockBackend
          .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk2))
          .respond(200, mockChunk2_2);
        var called = 0;
        await resolver.fetchDocs().then(function () {
          called++;
          expectAllDocsPresent(resolver);
        });
        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it('with chunkSize 0 performs no requests and yields empty docs', async () => {
        resolver = docResolverSvc.createResolver(docIds, mockSettings, 0);
        var called = 0;
        await resolver.fetchDocs().then(function () {
          called++;
          expect(resolver.docs.length).toBe(0);
        });
        expect(called).toBe(1);
        mockBackend.verifyNoOutstandingExpectation();
      });

      it('resolves in an exact chunk', async () => {
        resolver = docResolverSvc.createResolver(docIds, mockSettings, 4);
        var expectedUrlParamsChunk1 = {
          q: [encodeURIComponent('id:(doc1 OR doc2 OR doc3 OR doc4)')],
        };
        mockBackend
          .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk1))
          .respond(200, mockChunk1_1);
        var called = 0;
        await resolver.fetchDocs().then(function () {
          called++;
          expectAllDocsPresent(resolver);
        });
        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it('resolves in a bigger than needed chunk', async () => {
        resolver = docResolverSvc.createResolver(docIds, mockSettings, 424);
        var expectedUrlParamsChunk1 = {
          q: [encodeURIComponent('id:(doc1 OR doc2 OR doc3 OR doc4)')],
        };
        mockBackend
          .expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk1))
          .respond(200, mockChunk1_1);
        var called = 0;
        await resolver.fetchDocs().then(function () {
          called++;
          expectAllDocsPresent(resolver);
        });
        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });
    });
  });

  describe('Elasticsearch', () => {
    var mockEsUrl = 'http://localhost:9200/index/_search';
    var mockFieldSpecEs;
    var mockEsSettings;

    var esHitsForIds = function (idA, idB) {
      return {
        hits: {
          total: { value: 2, relation: 'eq' },
          max_score: 1.0,
          hits: [
            {
              _id: 'h1',
              _source: {
                id: idA,
                field: ['a'],
              },
            },
            {
              _id: 'h2',
              _source: {
                id: idB,
                field: ['b'],
              },
            },
          ],
        },
      };
    };

    beforeEach(() => {
      activeQueries.count = 0;
      mockFieldSpecEs = getFieldSpecSvc().createFieldSpec('field field1');
      mockEsSettings = {
        searchEngine: 'es',
        searchUrl: mockEsUrl,
        createFieldSpec: function () {
          return mockFieldSpecEs;
        },
        version: '7.0',
      };
    });

    it('resolves docs with a terms query on the id field and preserves order', async () => {
      var resolver = docResolverSvc.createResolver(['id-1', 'id-2'], mockEsSettings);
      mockBackend
        .expectPOST(mockEsUrl, function (body) {
          var q = JSON.parse(body);
          if (!q.query || !q.query.terms || q.query.terms.id === undefined) {
            return false;
          }
          return (
            JSON.stringify(q.query.terms.id) === JSON.stringify(['id-1', 'id-2']) && q.size === 2
          );
        })
        .respond(200, esHitsForIds('id-1', 'id-2'));

      var done = false;
      await resolver.fetchDocs().then(function () {
        expect(resolver.docs.length).toBe(2);
        expect(resolver.docs[0].id).toBe('id-1');
        expect(resolver.docs[1].id).toBe('id-2');
        done = true;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(done).toBe(true);
    });

    it('stubs missing Elasticsearch hits as placeholder normal docs', async () => {
      var resolver = docResolverSvc.createResolver(['id-1', 'id-2', 'missing'], mockEsSettings);
      mockBackend
        .expectPOST(mockEsUrl, function (body) {
          var q = JSON.parse(body);
          return (
            JSON.stringify(q.query.terms.id) === JSON.stringify(['id-1', 'id-2', 'missing']) &&
            q.size === 3
          );
        })
        .respond(200, esHitsForIds('id-1', 'id-2'));

      var done = false;
      await resolver.fetchDocs().then(function () {
        expect(resolver.docs.length).toBe(3);
        var byId = {};
        resolver.docs.forEach(function (d) {
          byId[d.id] = d;
        });
        expect(byId['id-1']).toBeDefined();
        expect(byId['id-2']).toBeDefined();
        expect(byId.missing.title.indexOf('Missing Doc')).toBe(0);
        done = true;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(done).toBe(true);
    });

    it('resolves ids when searchEngine is OpenSearch (os)', async () => {
      var osSettings = Object.assign({}, mockEsSettings, { searchEngine: 'os' });
      var resolver = docResolverSvc.createResolver(['id-1', 'id-2'], osSettings);
      mockBackend
        .expectPOST(mockEsUrl, function (body) {
          var q = JSON.parse(body);
          if (!q.query || !q.query.terms || q.query.terms.id === undefined) {
            return false;
          }
          return (
            JSON.stringify(q.query.terms.id) === JSON.stringify(['id-1', 'id-2']) && q.size === 2
          );
        })
        .respond(200, esHitsForIds('id-1', 'id-2'));

      var done = false;
      await resolver.fetchDocs().then(function () {
        expect(resolver.docs.length).toBe(2);
        expect(resolver.docs[0].id).toBe('id-1');
        done = true;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(done).toBe(true);
    });
  });

  describe('Algolia', () => {
    var mockAlgoliaUrl = 'https://index.algolianet.com/1/indexes/items/query';
    var mockAlgoliaSettings;

    beforeEach(() => {
      var mockAlgoliaFieldSpec = getFieldSpecSvc().createFieldSpec('id:id title:title');
      mockAlgoliaSettings = {
        searchEngine: 'algolia',
        searchUrl: mockAlgoliaUrl,
        createFieldSpec: function () {
          return mockAlgoliaFieldSpec;
        },
        apiMethod: 'POST',
      };
    });

    it('resolves docs by objectIDs via the multi-get endpoint', async () => {
      var resolver = docResolverSvc.createResolver(['obj-a', 'obj-b'], mockAlgoliaSettings);
      mockBackend
        .expectPOST('https://index.algolianet.com/1/indexes/*/objects', function (body) {
          var payload = JSON.parse(body);
          if (!payload.requests || payload.requests.length !== 2) {
            return false;
          }
          return (
            payload.requests[0].indexName === 'items' &&
            payload.requests[0].objectID === 'obj-a' &&
            payload.requests[1].objectID === 'obj-b'
          );
        })
        .respond(200, {
          results: [
            { objectID: 'obj-a', title: 'A' },
            { objectID: 'obj-b', title: 'B' },
          ],
          nbHits: 2,
        });

      var done = false;
      await resolver.fetchDocs().then(function () {
        expect(resolver.docs.length).toBe(2);
        expect(resolver.docs[0].id).toBe('obj-a');
        expect(resolver.docs[1].id).toBe('obj-b');
        done = true;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(done).toBe(true);
    });

    it('stubs missing Algolia objects as placeholder docs preserving order', async () => {
      var resolver = docResolverSvc.createResolver(['obj-a', 'missing'], mockAlgoliaSettings);
      mockBackend
        .expectPOST('https://index.algolianet.com/1/indexes/*/objects', function (body) {
          var payload = JSON.parse(body);
          return payload.requests && payload.requests.length === 2;
        })
        .respond(200, {
          results: [{ objectID: 'obj-a', title: 'A' }],
          nbHits: 1,
        });

      var done = false;
      await resolver.fetchDocs().then(function () {
        expect(resolver.docs.length).toBe(2);
        var byId = {};
        resolver.docs.forEach(function (d) {
          byId[d.id] = d;
        });
        expect(byId['obj-a'].title).toBe('A');
        expect(byId.missing.title.indexOf('Missing Doc')).toBe(0);
        done = true;
      });
      mockBackend.verifyNoOutstandingExpectation();
      expect(done).toBe(true);
    });
  });

  describe('Vectara', () => {
    var mockVectaraUrl = 'https://api.vectara.io:443/v1/query';
    var mockVectaraSettings;

    beforeEach(() => {
      mockVectaraSettings = {
        searchEngine: 'vectara',
        searchUrl: mockVectaraUrl,
        createFieldSpec: function () {
          return getFieldSpecSvc().createFieldSpec('field1 field2');
        },
        apiMethod: 'POST',
      };
    });

    it('creates a resolver that sets no args for vectara (no direct doc fetch)', () => {
      var resolver = docResolverSvc.createResolver(['id-1', 'id-2'], mockVectaraSettings);
      expect(resolver.searcher).toBeDefined();
      expect(resolver.searcher.type).toBe('vectara');
    });
  });

  describe('SearchAPI', () => {
    var mockSearchApiUrl = 'http://example.com/api/search';
    var mockSearchApiSettings;

    beforeEach(() => {
      mockSearchApiSettings = {
        searchEngine: 'searchapi',
        searchUrl: mockSearchApiUrl,
        createFieldSpec: function () {
          return getFieldSpecSvc().createFieldSpec('id:id title:title');
        },
        apiMethod: 'GET',
      };
    });

    it('creates a resolver that sets no args for searchapi (no direct doc fetch)', () => {
      var resolver = docResolverSvc.createResolver(['id-1', 'id-2'], mockSearchApiSettings);
      expect(resolver.searcher).toBeDefined();
      expect(resolver.searcher.type).toBe('searchapi');
    });
  });

  describe('Chunked fetch error handling', () => {
    it('creates resolver with chunk size', () => {
      var mockEsUrl = 'http://localhost:9200/index/_search';
      activeQueries.count = 0;
      var mockEsSettings = {
        searchEngine: 'es',
        searchUrl: mockEsUrl,
        createFieldSpec: function () {
          return getFieldSpecSvc().createFieldSpec('field field1');
        },
        version: '7.0',
      };

      var resolver = docResolverSvc.createResolver(['id-1', 'id-2'], mockEsSettings, 1);
      expect(resolver).toBeDefined();
      expect(resolver.docs).toEqual([]);
    });
  });

  describe('Resolver config propagation', () => {
    var mockSolrUrl = 'http://example.com:1234/collection1/select';

    it('propagates optional settings (version, proxyUrl, customHeaders) into config', () => {
      var settings = {
        createFieldSpec: function () {
          return mockFieldSpec;
        },
        searchUrl: mockSolrUrl,
        version: '8.0',
        proxyUrl: 'http://proxy.example.com/',
        customHeaders: '{"X-Test": "value"}',
        apiMethod: 'GET',
      };
      var resolver = docResolverSvc.createResolver(['doc1'], settings);
      expect(resolver.config.version).toBe('8.0');
      expect(resolver.config.proxyUrl).toBe('http://proxy.example.com/');
      expect(resolver.config.apiMethod).toBe('GET');
    });

    it('propagates basicAuthCredential and merges it into customHeaders', () => {
      var settings = {
        createFieldSpec: function () {
          return mockFieldSpec;
        },
        searchUrl: mockSolrUrl,
        basicAuthCredential: 'user:pass',
        apiMethod: 'GET',
      };
      var resolver = docResolverSvc.createResolver(['doc1'], settings);
      expect(resolver.config.basicAuthCredential).toBe('user:pass');
    });

    it('does not set optional config keys when they are undefined in settings', () => {
      var settings = {
        createFieldSpec: function () {
          return mockFieldSpec;
        },
        searchUrl: mockSolrUrl,
      };
      var resolver = docResolverSvc.createResolver(['doc1'], settings);
      expect(resolver.config.version).toBeUndefined();
      expect(resolver.config.proxyUrl).toBeUndefined();
      expect(resolver.config.customHeaders).toBeUndefined();
    });
  });
});

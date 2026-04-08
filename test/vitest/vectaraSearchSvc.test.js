import { describe, it, expect, beforeEach } from 'vitest';
import { createFetchClient } from '../../services/httpClient.js';
import { MockHttpBackend } from './helpers/mockHttpBackend.js';
import { getSearchSvc, getFieldSpecSvc } from './helpers/serviceFactory.js';

describe('searchSvc: Vectara', () => {
  var searchSvc;
  var fieldSpecSvc;
  var mockBackend;
  var mockFieldSpec;
  var searcher;
  var mockVectaraUrl = 'https://api.vectara.io:443/v1/query';
  var mockQueryText = 'test';
  var mockVectaraParam = {
    query: [
      {
        query: '#$query##',
        numResults: 10,
        corpusKey: [{ corpusId: 1 }],
      },
    ],
  };

  var mockVectaraResults = {
    responseSet: [
      {
        response: [],
        status: [],
        document: [
          {
            id: '1',
            metadata: [
              { name: 'field1', value: '1--field1 value' },
              { name: 'field2', value: '1--field2 value' },
            ],
          },
          {
            id: '2',
            metadata: [
              { name: 'field1', value: '2--field1 value' },
              { name: 'field2', value: '2--field2 value' },
            ],
          },
        ],
        generated: [],
        summary: [],
        futureId: 1,
      },
    ],
    status: [],
    metrics: null,
  };

  beforeEach(() => {
    mockBackend = new MockHttpBackend();
    var httpClient = createFetchClient({
      fetch: mockBackend.fetch,
      jsonpRequest: mockBackend.jsonpRequest,
    });
    searchSvc = getSearchSvc(httpClient);
    fieldSpecSvc = getFieldSpecSvc();
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field1 field2');
  });

  describe('vectara search', () => {
    beforeEach(() => {
      searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockVectaraUrl,
        mockVectaraParam,
        mockQueryText,
        {},
        'vectara',
      );
    });

    it('returns docs', async () => {
      mockBackend.expectPOST(mockVectaraUrl).respond(200, mockVectaraResults);

      var called = 0;
      await searcher.search().then(function () {
        var docs = searcher.docs;
        expect(docs.length).toEqual(2);
        expect(docs[0].field1).toEqual('1--field1 value');
        expect(docs[0].field2).toEqual('1--field2 value');
        expect(docs[1].field1).toEqual('2--field1 value');
        expect(docs[1].field2).toEqual('2--field2 value');
        called++;
      });

      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });

    it('sets numFound from documents array length', async () => {
      mockBackend.expectPOST(mockVectaraUrl).respond(200, mockVectaraResults);

      var called = 0;
      await searcher.search().then(function () {
        expect(searcher.numFound).toEqual(2);
        called++;
      });
      expect(called).toEqual(1);
    });

    it('handles empty responseSet', async () => {
      var emptyResponse = {
        responseSet: [],
        status: [],
        metrics: null,
      };
      mockBackend.expectPOST(mockVectaraUrl).respond(200, emptyResponse);

      var called = 0;
      await searcher.search().then(function () {
        expect(searcher.docs.length).toEqual(0);
        expect(searcher.numFound).toEqual(0);
        called++;
      });
      expect(called).toEqual(1);
    });

    it('handles missing responseSet', async () => {
      var noResponseSet = {
        status: [],
        metrics: null,
      };
      mockBackend.expectPOST(mockVectaraUrl).respond(200, noResponseSet);

      var called = 0;
      await searcher.search().then(function () {
        expect(searcher.docs.length).toEqual(0);
        expect(searcher.numFound).toEqual(0);
        called++;
      });
      expect(called).toEqual(1);
    });

    it('rejects on HTTP error', async () => {
      mockBackend.expectPOST(mockVectaraUrl).respond(500, { error: 'Internal Server Error' });

      var errorCalled = 0;
      await searcher.search().then(
        function () {
          errorCalled--;
        },
        function (msg) {
          expect(msg.searchError).toContain('Error with Vectara query');
          expect(searcher.inError).toBe(true);
          errorCalled++;
        },
      );
      expect(errorCalled).toEqual(1);
    });

    it('merges customHeaders from config onto the outbound request', async () => {
      var custom = JSON.stringify({ 'X-Custom-Header': 'integration-test' });
      var configuredSearcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockVectaraUrl,
        mockVectaraParam,
        mockQueryText,
        { customHeaders: custom },
        'vectara',
      );

      mockBackend
        .expectPOST(mockVectaraUrl, undefined, function (headers) {
          return (
            headers['X-Custom-Header'] === 'integration-test' ||
            headers['x-custom-header'] === 'integration-test'
          );
        })
        .respond(200, mockVectaraResults);

      var called = 0;
      await configuredSearcher.search().then(function () {
        expect(configuredSearcher.docs.length).toBe(2);
        called++;
      });
      expect(called).toBe(1);
    });
  });

  describe('vectara pager', () => {
    var mockVectaraParamWithPager;

    beforeEach(() => {
      mockVectaraParamWithPager = structuredClone(mockVectaraParam);
      mockVectaraParamWithPager.pager = { from: 0, size: 2 };

      searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockVectaraUrl,
        mockVectaraParamWithPager,
        mockQueryText,
        {},
        'vectara',
      );
    });

    it('returns a new searcher for the next page', async () => {
      var manyDocsResponse = structuredClone(mockVectaraResults);
      manyDocsResponse.responseSet[0].document = [];
      for (var i = 0; i < 10; i++) {
        manyDocsResponse.responseSet[0].document.push({
          id: '' + i,
          metadata: [{ name: 'field1', value: 'val' + i }],
        });
      }

      mockBackend.expectPOST(mockVectaraUrl).respond(200, manyDocsResponse);

      var called = 0;
      await searcher.search().then(function () {
        var pagerSearcher = searcher.pager();
        expect(pagerSearcher).not.toBeNull();
        expect(pagerSearcher).toBeDefined();
        called++;
      });
      expect(called).toEqual(1);
    });

    it('returns null when all results exhausted', async () => {
      mockBackend.expectPOST(mockVectaraUrl).respond(200, mockVectaraResults);

      var called = 0;
      await searcher.search().then(function () {
        var pagerSearcher = searcher.pager();
        expect(pagerSearcher).toBeNull();
        called++;
      });
      expect(called).toEqual(1);
    });
  });

  describe('vectara addDocToGroup', () => {
    beforeEach(() => {
      searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockVectaraUrl,
        mockVectaraParam,
        mockQueryText,
        {},
        'vectara',
      );
    });

    it('creates a new group when groupedBy key does not exist', () => {
      var mockDoc = { id: '1', field1: 'value1' };
      searcher.addDocToGroup('category', 'groupA', mockDoc);

      expect(searcher.grouped.category).toBeDefined();
      expect(searcher.grouped.category.length).toEqual(1);
      expect(searcher.grouped.category[0].value).toEqual('groupA');
      expect(searcher.grouped.category[0].docs).toContain(mockDoc);
    });

    it('adds to existing group when same groupedBy and group value', () => {
      var mockDoc1 = { id: '1', field1: 'value1' };
      var mockDoc2 = { id: '2', field1: 'value2' };

      searcher.addDocToGroup('category', 'groupA', mockDoc1);
      searcher.addDocToGroup('category', 'groupA', mockDoc2);

      expect(searcher.grouped.category.length).toEqual(1);
      expect(searcher.grouped.category[0].docs.length).toEqual(2);
      expect(searcher.grouped.category[0].docs).toContain(mockDoc1);
      expect(searcher.grouped.category[0].docs).toContain(mockDoc2);
    });

    it('creates separate group entries for different group values', () => {
      var mockDoc1 = { id: '1', field1: 'value1' };
      var mockDoc2 = { id: '2', field1: 'value2' };

      searcher.addDocToGroup('category', 'groupA', mockDoc1);
      searcher.addDocToGroup('category', 'groupB', mockDoc2);

      expect(searcher.grouped.category.length).toEqual(2);
      expect(searcher.grouped.category[0].value).toEqual('groupA');
      expect(searcher.grouped.category[1].value).toEqual('groupB');
    });
  });
});

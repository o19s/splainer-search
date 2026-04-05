'use strict';

/*global createFetchClient, MockHttpBackend*/
describe('Service: searchSvc: Vectara', function() {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  var mockBackend;
  beforeEach(module(function ($provide) {
    mockBackend = new MockHttpBackend();
    $provide.factory('httpClient', function () {
      return createFetchClient({
        fetch: mockBackend.fetch,
        jsonpRequest: mockBackend.jsonpRequest,
      });
    });
  }));

  let searcher;
  let searchSvc;
  let vectaraUrlSvc;
  let fieldSpecSvc  = null;
  let mockVectaraUrl     = 'https://api.vectara.io:443/v1/query';
  let mockFieldSpec = null;
  const mockQueryText = 'test';
  const mockVectaraParam = { query: [
      {
        query: '#$query##',
        numResults: 10,
        corpusKey :[{
          corpusId: 1
        }]
      }
    ]};

  beforeEach(inject(function (_searchSvc_, _fieldSpecSvc_, _vectaraUrlSvc_) {
    searchSvc     = _searchSvc_;
    fieldSpecSvc  = _fieldSpecSvc_;
    vectaraUrlSvc = _vectaraUrlSvc_;
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field1 field2');
  }));


  var mockVectaraResults = {
    responseSet: [ {
      response: [],
      status: [],
      document: [
        {
          "id": "1",
          "metadata": [
            {
              "name": "field1",
              "value": "1--field1 value"
            },
            {
              "name": "field2",
              "value": "1--field2 value"
            }
          ]
        },
        {
          "id": "2",
          "metadata": [
            {
              "name": "field1",
              "value": "2--field1 value"
            },
            {
              "name": "field2",
              "value": "2--field2 value"
            }
          ]
        },
      ],
      generated: [],
      summary: [],
      futureId: 1
    }],
    "status": [],
    "metrics": null
  };

  describe('vectara search', function () {

    beforeEach(inject(function () {
      searcher = searchSvc.createSearcher(
          mockFieldSpec,
          mockVectaraUrl,
          mockVectaraParam,
          mockQueryText,
          {},
          'vectara'
      );
    }));

    it('returns docs', async function () {
      mockBackend.expectPOST(mockVectaraUrl).respond(200, mockVectaraResults);

      var called = 0;

      await searcher.search()
          .then(function () {
            var docs = searcher.docs;
            expect(docs.length).toEqual(2);

            expect(docs[0].field1).toEqual("1--field1 value");
            expect(docs[0].field2).toEqual("1--field2 value");
            expect(docs[1].field1).toEqual("2--field1 value");
            expect(docs[1].field2).toEqual("2--field2 value");
            called++;
          });

      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });

    it('sets numFound from documents array length', async function () {
      mockBackend.expectPOST(mockVectaraUrl).respond(200, mockVectaraResults);

      var called = 0;
      await searcher.search()
        .then(function () {
          expect(searcher.numFound).toEqual(2);
          called++;
        });

      expect(called).toEqual(1);
    });

    it('handles empty responseSet', async function () {
      var emptyResponse = {
        responseSet: [],
        status: [],
        metrics: null
      };
      mockBackend.expectPOST(mockVectaraUrl).respond(200, emptyResponse);

      var called = 0;
      await searcher.search()
        .then(function () {
          expect(searcher.docs.length).toEqual(0);
          expect(searcher.numFound).toEqual(0);
          called++;
        });

      expect(called).toEqual(1);
    });

    it('handles missing responseSet', async function () {
      var noResponseSet = {
        status: [],
        metrics: null
      };
      mockBackend.expectPOST(mockVectaraUrl).respond(200, noResponseSet);

      var called = 0;
      await searcher.search()
        .then(function () {
          expect(searcher.docs.length).toEqual(0);
          expect(searcher.numFound).toEqual(0);
          called++;
        });

      expect(called).toEqual(1);
    });

    it('rejects on HTTP error', async function () {
      mockBackend.expectPOST(mockVectaraUrl).respond(500, {error: 'Internal Server Error'});

      var errorCalled = 0;
      await searcher.search()
        .then(function () {
          errorCalled--;
        }, function (msg) {
          expect(msg.searchError).toContain('Error with Vectara query');
          expect(searcher.inError).toBe(true);
          errorCalled++;
        });

      expect(errorCalled).toEqual(1);
    });

    it('merges customHeaders from config through vectaraUrlSvc onto the outbound request', async function () {
      spyOn(vectaraUrlSvc, 'getHeaders').and.callThrough();
      var custom = JSON.stringify({ 'X-Custom-Header': 'integration-test' });
      var configuredSearcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockVectaraUrl,
        mockVectaraParam,
        mockQueryText,
        { customHeaders: custom },
        'vectara'
      );

      mockBackend.expectPOST(mockVectaraUrl, undefined, function (headers) {
        return headers['X-Custom-Header'] === 'integration-test' ||
          headers['x-custom-header'] === 'integration-test';
      }).respond(200, mockVectaraResults);

      var called = 0;
      await configuredSearcher.search().then(function () {
        expect(configuredSearcher.docs.length).toBe(2);
        called++;
      });
      expect(called).toBe(1);
      expect(vectaraUrlSvc.getHeaders).toHaveBeenCalledWith(custom);
    });
  });

  describe('vectara pager', function () {

    var mockVectaraParamWithPager;

    beforeEach(inject(function () {
      mockVectaraParamWithPager = structuredClone(mockVectaraParam);
      mockVectaraParamWithPager.pager = { from: 0, size: 2 };

      searcher = searchSvc.createSearcher(
          mockFieldSpec,
          mockVectaraUrl,
          mockVectaraParamWithPager,
          mockQueryText,
          {},
          'vectara'
      );
    }));

    it('returns a new searcher for the next page', async function () {
      // 10 total results so paging should continue
      var manyDocsResponse = structuredClone(mockVectaraResults);
      manyDocsResponse.responseSet[0].document = [];
      for (var i = 0; i < 10; i++) {
        manyDocsResponse.responseSet[0].document.push({
          id: '' + i,
          metadata: [{ name: 'field1', value: 'val' + i }]
        });
      }

      mockBackend.expectPOST(mockVectaraUrl).respond(200, manyDocsResponse);

      var called = 0;
      await searcher.search()
        .then(function () {
          var pagerSearcher = searcher.pager();
          expect(pagerSearcher).not.toBeNull();
          expect(pagerSearcher).toBeDefined();
          called++;
        });

      expect(called).toEqual(1);
    });

    it('returns null when all results exhausted', async function () {
      // Only 2 results with page size 2 — no next page
      mockBackend.expectPOST(mockVectaraUrl).respond(200, mockVectaraResults);

      var called = 0;
      await searcher.search()
        .then(function () {
          var pagerSearcher = searcher.pager();
          expect(pagerSearcher).toBeNull();
          called++;
        });

      expect(called).toEqual(1);
    });
  });

  describe('vectara addDocToGroup', function () {

    beforeEach(inject(function () {
      searcher = searchSvc.createSearcher(
          mockFieldSpec,
          mockVectaraUrl,
          mockVectaraParam,
          mockQueryText,
          {},
          'vectara'
      );
    }));

    it('creates a new group when groupedBy key does not exist', function () {
      var mockDoc = { id: '1', field1: 'value1' };
      searcher.addDocToGroup('category', 'groupA', mockDoc);

      expect(searcher.grouped.category).toBeDefined();
      expect(searcher.grouped.category.length).toEqual(1);
      expect(searcher.grouped.category[0].value).toEqual('groupA');
      expect(searcher.grouped.category[0].docs).toContain(mockDoc);
    });

    it('adds to existing group when same groupedBy and group value', function () {
      var mockDoc1 = { id: '1', field1: 'value1' };
      var mockDoc2 = { id: '2', field1: 'value2' };

      searcher.addDocToGroup('category', 'groupA', mockDoc1);
      searcher.addDocToGroup('category', 'groupA', mockDoc2);

      expect(searcher.grouped.category.length).toEqual(1);
      expect(searcher.grouped.category[0].docs.length).toEqual(2);
      expect(searcher.grouped.category[0].docs).toContain(mockDoc1);
      expect(searcher.grouped.category[0].docs).toContain(mockDoc2);
    });

    it('creates separate group entries for different group values', function () {
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

'use strict';
/* global createFetchClient, MockHttpBackend */
describe('Service: searchSvc: Algolia', function () {

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

  // instantiate service
  var searchSvc;
  var activeQueries;
  var fieldSpecSvc = null;
  var mockAlgoliaUrl = 'https://index.algolianet.com/1/indexes/ecommerce-index/query';
  var mockAlgoliaParams = {
    "query": "#$query##",
    "clickAnalytics": true,
    "getRankingInfo": true,
    "explain": [],
    "filters": "searchFields.publiclyAvailable:true",
    "restrictSearchableAttributes": ["title","description"],
    "enableReRanking": true,
    "attributesToRetrieve": ["objectID","title","landingUrl","imageUrl"],
    "facets": [],
    "attributesToHighlight": [],
    "page": 0,
    "hitsPerPage": 5
  };
  var expectedParams = structuredClone(mockAlgoliaParams);
  var mockQueryText = 'post';
  var mockFieldSpec = null;
  expectedParams.query = encodeURIComponent(mockQueryText);

  var expectedPayload = {
    "query": "post",
    "clickAnalytics": true,
    "getRankingInfo": true,
    "explain": [],
    "filters": "searchFields.publiclyAvailable:true",
    "restrictSearchableAttributes": ["title","description"],
    "enableReRanking": true,
    "attributesToRetrieve": ["objectID","title","landingUrl","imageUrl"],
    "facets": [],
    "attributesToHighlight": [],
    "page": 0,
    "hitsPerPage": 5
  };

  var mockAlgoliaResults = {
    "hits": [
      {
        "title": "Custom Post-it Notes®",
        "imageUrl": "https://example.com/image.png",
        "landingUrl": "/stationery/stationery/sticky-notes",
        "objectID": "postItNotes",
        "_rankingInfo": {
          "promoted": true,
          "promotedByReRanking": true,
          "nbTypos": 0,
          "firstMatchedWord": 0,
          "proximityDistance": 0,
          "userScore": 5805,
          "geoDistance": 0,
          "geoPrecision": 1,
          "nbExactWords": 0,
          "words": 1,
          "filters": 1
        }
      },
      {
        "title": "Postcards",
        "imageUrl": "https://example.com/image.png",
        "landingUrl": "/marketing-materials/postcards",
        "objectID": "postcards",
        "_rankingInfo": {
          "promoted": true,
          "promotedByReRanking": true,
          "nbTypos": 0,
          "firstMatchedWord": 0,
          "proximityDistance": 0,
          "userScore": 5842,
          "geoDistance": 0,
          "geoPrecision": 1,
          "nbExactWords": 0,
          "words": 1,
          "filters": 1
        }
      },
      {
        "title": "Posters",
        "imageUrl": "https://example.com/image.png",
        "objectID": "posters",
        "_rankingInfo": {
          "nbTypos": 0,
          "firstMatchedWord": 0,
          "proximityDistance": 0,
          "userScore": 5837,
          "geoDistance": 0,
          "geoPrecision": 1,
          "nbExactWords": 0,
          "words": 1,
          "filters": 1
        }
      },
      {
        "title": "Postcard Mailing Services",
        "imageUrl": "https://example.com/image.png",
        "landingUrl": "/marketing-materials/mailing-services-postcards",
        "objectID": "mailingServicesPostcard",
        "_rankingInfo": {
          "nbTypos": 0,
          "firstMatchedWord": 0,
          "proximityDistance": 0,
          "userScore": 5794,
          "geoDistance": 0,
          "geoPrecision": 1,
          "nbExactWords": 0,
          "words": 1,
          "filters": 1
        }
      },
      {
        "title": "Magnetic Postcards",
        "imageUrl": "https://example.com/image.png",
        "objectID": "postcardMagnets",
        "_rankingInfo": {
          "nbTypos": 0,
          "firstMatchedWord": 0,
          "proximityDistance": 0,
          "userScore": 5739,
          "geoDistance": 0,
          "geoPrecision": 1,
          "nbExactWords": 0,
          "words": 1,
          "filters": 1
        }
      }
    ],
    "nbHits": 10,
    "page": 0,
    "nbPages": 2,
    "hitsPerPage": 5,
    "exhaustiveNbHits": true,
    "exhaustiveTypo": true,
    "exhaustive": {
      "nbHits": true,
      "typo": true
    },
    "query": "post",
    "params": "query=post&clickAnalytics=true&getRankingInfo=true&explain=%5B%5D&filters=searchFields.publiclyAvailable%3Atrue&restrictSearchableAttributes=%5B%22title%22%2C%22description%22%5D&enableReRanking=true&attributesToRetrieve=%5B%22objectID%22%2C%22title%22%2C%22landingUrl%22%2C%22imageUrl%22%5D&facets=%5B%5D&attributesToHighlight=%5B%5D&page=0&hitsPerPage=5",
    "queryID": "6d1f7f2b9cb32d2f7e14aafc227ebe72",
    "serverUsed": "index.algolia.net",
    "indexUsed": "ecommerce-index",
    "parsedQuery": "post",
    "timeoutCounts": false,
    "timeoutHits": false,
    "aiReRanking": {
      "reRankingActivated": true,
      "persoImpactInsideActivationWindow": false
    },
    "appliedRules": [
      {
        "objectID": "qr-1639660923688"
      },
      {
        "objectID": "qr-1645452701801"
      },
      {
        "objectID": "qr-1652790481258"
      },
      {
        "objectID": "qr-1664469634538"
      },
      {
        "objectID": "qr-1679653593689"
      }
    ],
    "renderingContent": {},
    "extensions": {
      "queryCategorization": {}
    },
    "processingTimeMS": 2,
    "processingTimingsMS": {
      "_request": {
        "roundTrip": 148
      },
      "extensions": 1,
      "total": 2
    },
    "serverTimeMS": 2
  };

  var expectedGetObjectsPayload = {
    requests: [{
      indexName: "ecommerce-index",
      objectID: "potato",
    },{
      indexName: "ecommerce-index",
      objectID: "patato",
    }, {
      indexName: "ecommerce-index",
      objectID: "tomato",
    }, {
      indexName: "ecommerce-index",
      objectID: "tamato",
    }]
  }

  var mockGetObjectsResponse = {
    "results":[
      {
        "title": "Potato",
        "objectID": "potato"
      },
      {
        "title": "Patato",
        "objectID": "patato"
      },
      {
        "title": "Tomato",
        "objectID": "tomato"
      },
      {
        "title": "Tamato",
        "objectID": "tamato"
      },
    ]
  }

  beforeEach(inject(function (_searchSvc_, _fieldSpecSvc_, _activeQueries_) {
    searchSvc     = _searchSvc_;
    fieldSpecSvc  = _fieldSpecSvc_;
    activeQueries = _activeQueries_;
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1 hl:field2');

    activeQueries.count = 0;
  }));


  it('access Algolia using GET', function() {
    expect(function() {
      searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
        mockAlgoliaParams, mockQueryText, { apiMethod: 'GET' }, 'algolia');
    }).toThrowError('GET is not supported by Algolia');
  });

  it('access Algolia using POST', async function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
                                                mockAlgoliaParams, mockQueryText, { apiMethod: 'POST' }, 'algolia');

    mockBackend.expectPOST("https://index.algolianet.com/1/indexes/ecommerce-index/query", expectedPayload).respond(200, mockAlgoliaResults);
    await searcher.search();
    mockBackend.verifyNoOutstandingExpectation();
  });

  it('returns number found', async function () {

    var options = { apiMethod: 'POST' };

    var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
                                                mockAlgoliaParams, mockQueryText, options, 'algolia');

    mockBackend.expectPOST("https://index.algolianet.com/1/indexes/ecommerce-index/query").respond(200, mockAlgoliaResults);

    await searcher.search();

    mockBackend.verifyNoOutstandingExpectation();
    expect(searcher.numFound).toEqual(10);
  });

  it('returns docs', async function () {

    var options = { apiMethod: 'POST' };

    var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
                                                mockAlgoliaParams, mockQueryText, options, 'algolia');

    mockBackend.expectPOST("https://index.algolianet.com/1/indexes/ecommerce-index/query").respond(200, mockAlgoliaResults);

    var called = 0;

    await searcher.search()
        .then(function () {

          var docs = searcher.docs;
          expect(docs.length).toEqual(5);

          expect(docs[0].title).toEqual("Custom Post-it Notes®");
          expect(docs[0].id).toEqual("postItNotes");
          expect(docs[1].title).toEqual("Postcards");
          expect(docs[1].id).toEqual("postcards");

          called++;
        });

    mockBackend.verifyNoOutstandingExpectation();

    expect(called).toEqual(1);
  });

  it('queries docs by id', async function () {
    var options = {
      apiMethod: 'POST',
    };

    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockAlgoliaUrl,
      {
        objectIds: ['potato', 'patato', 'tomato', 'tamato'],
        retrieveObjects: true
      }, mockQueryText, options, 'algolia');

    mockBackend.expectPOST("https://index.algolianet.com/1/indexes/*/objects", expectedGetObjectsPayload).respond(200, mockGetObjectsResponse);

    var called = 0;

    await searcher.search()
      .then(function () {

        var docs = searcher.docs;
        expect(docs.length).toEqual(4);
        expect(searcher.numFound).toEqual(4);
        expect(searcher.nbPages).toEqual(1);

        expect(docs[0].title).toEqual("Potato");
        expect(docs[0].id).toEqual("potato");
        expect(docs[1].title).toEqual("Patato");
        expect(docs[1].id).toEqual("patato");

        called++;
      });

    mockBackend.verifyNoOutstandingExpectation();

    expect(called).toEqual(1);
    expect(searcher.pager()).toBeNull();
  });

  /**
   * Algolia uses `page`, `hitsPerPage`, and `nbPages` from the API rather than Solr/ES offset paging.
   * Coverage mirrors Solr paging: multi-step advancement, custom `hitsPerPage`, single-page exhaustion,
   * non-zero start `page`, config carried on the paged searcher, highlight args on page 2, and HTTP
   * failure on a follow-up page.
   */
  describe('paging', function() {

    function responseForPage(base, pageIndex, nbPages) {
      var r = structuredClone(base);
      r.page = pageIndex;
      if (nbPages !== undefined) {
        r.nbPages = nbPages;
      }
      return r;
    }

    it('pages on page', async function() {
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
        mockAlgoliaParams, mockQueryText, { apiMethod: 'POST' }, 'algolia');

      var threePages = responseForPage(mockAlgoliaResults, 0, 3);
      threePages.nbHits = 12;

      mockBackend.expectPOST(mockAlgoliaUrl, expectedParams).respond(200, threePages);
      await searcher.search();

      var nextSearcher = searcher.pager();

      mockBackend.expectPOST(mockAlgoliaUrl, Object.assign({}, expectedParams, { page: 1 }))
        .respond(200, responseForPage(threePages, 1));

      await nextSearcher.search();

      nextSearcher = nextSearcher.pager();

      mockBackend.expectPOST(mockAlgoliaUrl, Object.assign({}, expectedParams, { page: 2 }))
        .respond(200, responseForPage(threePages, 2));

      await nextSearcher.search();

      nextSearcher = nextSearcher.pager();
      expect(nextSearcher).toBe(null);
    });

    it('accounts for custom hitsPerPage in args', async function() {
      var params20 = structuredClone(mockAlgoliaParams);
      params20.hitsPerPage = 20;
      var expected20 = structuredClone(expectedParams);
      expected20.hitsPerPage = 20;

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
        params20, mockQueryText, { apiMethod: 'POST' }, 'algolia');

      var twoPages = structuredClone(mockAlgoliaResults);
      twoPages.hitsPerPage = 20;
      twoPages.nbHits = 35;
      twoPages.nbPages = 2;
      twoPages.page = 0;

      mockBackend.expectPOST(mockAlgoliaUrl, expected20).respond(200, twoPages);
      await searcher.search();

      var nextSearcher = searcher.pager();
      mockBackend.expectPOST(mockAlgoliaUrl, Object.assign({}, expected20, { page: 1 }))
        .respond(200, Object.assign({}, twoPages, { page: 1 }));

      await nextSearcher.search();

      nextSearcher = nextSearcher.pager();
      expect(nextSearcher).toBe(null);
    });

    it('returns null when the first response is already the only page', async function() {
      var onePage = responseForPage(mockAlgoliaResults, 0, 1);
      onePage.nbHits = 3;

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
        mockAlgoliaParams, mockQueryText, { apiMethod: 'POST' }, 'algolia');

      mockBackend.expectPOST(mockAlgoliaUrl, expectedParams).respond(200, onePage);
      await searcher.search();

      expect(searcher.pager()).toBe(null);
    });

    it('advances from a non-zero starting page in args', async function() {
      var paramsFrom2 = structuredClone(mockAlgoliaParams);
      paramsFrom2.page = 2;
      var expectedFrom2 = structuredClone(expectedParams);
      expectedFrom2.page = 2;

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
        paramsFrom2, mockQueryText, { apiMethod: 'POST' }, 'algolia');

      var first = responseForPage(mockAlgoliaResults, 2, 5);
      first.nbHits = 80;

      mockBackend.expectPOST(mockAlgoliaUrl, expectedFrom2).respond(200, first);
      await searcher.search();

      var nextSearcher = searcher.pager();
      expect(nextSearcher).not.toBe(null);

      mockBackend.expectPOST(mockAlgoliaUrl, Object.assign({}, expectedFrom2, { page: 3 }))
        .respond(200, responseForPage(first, 3, 5));

      await nextSearcher.search();

      nextSearcher = nextSearcher.pager();
      expect(nextSearcher).not.toBe(null);

      mockBackend.expectPOST(mockAlgoliaUrl, Object.assign({}, expectedFrom2, { page: 4 }))
        .respond(200, responseForPage(first, 4, 5));

      await nextSearcher.search();

      expect(nextSearcher.pager()).toBe(null);
    });

    it('preserves config on the next-page searcher before the first search (Solr escapeQuery parity)', function() {
      var cfg = { apiMethod: 'POST', proxyUrl: 'http://myserver/proxy?proxy=' };
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
        mockAlgoliaParams, mockQueryText, cfg, 'algolia');

      var nextSearcher = searcher.pager();
      expect(nextSearcher.config.proxyUrl).toBe(cfg.proxyUrl);
      expect(nextSearcher.config.apiMethod).toBe('POST');
    });

    it('keeps attributesToHighlight on the paged request body (Solr highlights-new-page parity)', async function() {
      var paramsHl = structuredClone(mockAlgoliaParams);
      paramsHl.attributesToHighlight = ['title', 'description'];
      var expectedHl = structuredClone(expectedPayload);
      expectedHl.attributesToHighlight = ['title', 'description'];

      var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
        paramsHl, mockQueryText, { apiMethod: 'POST' }, 'algolia');

      var twoPages = responseForPage(mockAlgoliaResults, 0, 2);
      twoPages.nbHits = 8;

      mockBackend.expectPOST(mockAlgoliaUrl, expectedHl).respond(200, twoPages);
      await searcher.search();

      var nextSearcher = searcher.pager();
      var expectedPage1 = Object.assign({}, expectedHl, { page: 1 });
      mockBackend.expectPOST(mockAlgoliaUrl, expectedPage1).respond(200, responseForPage(twoPages, 1));

      await nextSearcher.search();

      expect(nextSearcher.pager()).toBe(null);
    });

    it('rejects and sets inError when a paged search HTTP call fails', async function() {
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
        mockAlgoliaParams, mockQueryText, { apiMethod: 'POST' }, 'algolia');

      var twoPages = responseForPage(mockAlgoliaResults, 0, 2);
      mockBackend.expectPOST(mockAlgoliaUrl, expectedParams).respond(200, twoPages);
      await searcher.search();

      var nextSearcher = searcher.pager();
      mockBackend.expectPOST(mockAlgoliaUrl, Object.assign({}, expectedParams, { page: 1 }))
        .respond(500, { error: 'page2 fail' });

      var failed = 0;
      await nextSearcher.search().then(null, function(msg) {
        expect(msg.searchError).toContain('Error with Algolia');
        expect(nextSearcher.inError).toBe(true);
        failed++;
      });
      expect(failed).toBe(1);
    });
  });

  it('rejects on HTTP error and sets inError', async function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
      mockAlgoliaParams, mockQueryText, { apiMethod: 'POST' }, 'algolia');

    mockBackend.expectPOST(mockAlgoliaUrl).respond(500, { error: 'Internal Server Error' });

    var errorCalled = 0;
    await searcher.search()
      .then(function() {
        errorCalled--;
      }, function(msg) {
        expect(msg.searchError).toContain('Error with Algolia');
        expect(searcher.inError).toBe(true);
        errorCalled++;
      });

    mockBackend.verifyNoOutstandingExpectation();
    expect(errorCalled).toEqual(1);
  });

  it('decrements activeQueries on error', async function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
      mockAlgoliaParams, mockQueryText, { apiMethod: 'POST' }, 'algolia');

    var initialCount = activeQueries.count;
    mockBackend.expectPOST(mockAlgoliaUrl).respond(500, {});

    await searcher.search().then(null, function() {});
    expect(activeQueries.count).toEqual(initialCount);
  });

  it('increments and decrements activeQueries on success', async function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
      mockAlgoliaParams, mockQueryText, { apiMethod: 'POST' }, 'algolia');

    var initialCount = activeQueries.count;
    mockBackend.expectPOST(mockAlgoliaUrl).respond(200, mockAlgoliaResults);

    await searcher.search();
    expect(activeQueries.count).toEqual(initialCount);
  });

  it('stores lastResponse on success', async function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
      mockAlgoliaParams, mockQueryText, { apiMethod: 'POST' }, 'algolia');

    mockBackend.expectPOST(mockAlgoliaUrl).respond(200, mockAlgoliaResults);

    var called = 0;
    await searcher.search().then(function() {
      expect(searcher.lastResponse).toBeDefined();
      expect(searcher.lastResponse.nbHits).toEqual(10);
      called++;
    });

    expect(called).toEqual(1);
  });

  it('getTransportParameters returns query URL, hits key, and hydrated payload when not retrieving objects', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
      mockAlgoliaParams, mockQueryText, { apiMethod: 'POST' }, 'algolia');

    var tp = searcher.getTransportParameters(false);
    expect(tp.url).toContain('/1/indexes/ecommerce-index/query');
    expect(tp.responseKey).toBe('hits');
    expect(tp.payload.query).toBe(mockQueryText);
    expect(tp.headers).toBeDefined();
  });

  it('getTransportParameters uses multi-get objects URL and results key when retrieving objects', function() {
    var searcher = searchSvc.createSearcher(
      mockFieldSpec,
      mockAlgoliaUrl,
      {
        objectIds: ['potato', 'patato'],
        retrieveObjects: true,
      },
      mockQueryText,
      { apiMethod: 'POST' },
      'algolia');

    var tp = searcher.getTransportParameters(true);
    expect(tp.url).toContain('/1/indexes/*/objects');
    expect(tp.responseKey).toBe('results');
    expect(tp.payload.requests.length).toBe(2);
    expect(tp.payload.requests[0].indexName).toBe('ecommerce-index');
    expect(tp.payload.requests[0].objectID).toBe('potato');
  });

  it('addDocToGroup is callable (stub implementation)', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
      mockAlgoliaParams, mockQueryText, { apiMethod: 'POST' }, 'algolia');
    expect(function() {
      searcher.addDocToGroup('field', 'groupVal', { id: 'x' });
    }).not.toThrow();
  });
});

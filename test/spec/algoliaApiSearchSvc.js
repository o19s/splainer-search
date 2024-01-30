'use strict';
/* global urlContainsParams, urlMissingParams, mockExplainOther*/
/*global describe,beforeEach,inject,it,expect*/
describe('Service: searchSvc: Algolia', function () {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  // instantiate service
  var searchSvc;
  var activeQueries;
  var $httpBackend = null;
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
  var expectedParams = angular.copy(mockAlgoliaParams);
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

  beforeEach(inject(function($injector) {
    $httpBackend = $injector.get('$httpBackend');
  }));

  beforeEach(inject(function (_searchSvc_, _fieldSpecSvc_, _activeQueries_) {
    searchSvc     = _searchSvc_;
    fieldSpecSvc  = _fieldSpecSvc_;
    activeQueries = _activeQueries_;
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1 hl:field2');

    activeQueries.count = 0;
  }));


  it('access Algolia using GET', function() {
    try {
      var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
        mockAlgoliaParams, mockQueryText, { apiMethod: 'GET' }, 'algolia');
    } catch (e) {
      expect(e.message === 'GET is not supported by Algolia');
    }
  });

  it('access Algolia using POST', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
                                                mockAlgoliaParams, mockQueryText, { apiMethod: 'POST' }, 'algolia');

    $httpBackend.expectPOST("https://index.algolianet.com/1/indexes/ecommerce-index/query", expectedPayload).respond(200, mockAlgoliaResults);
    searcher.search();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('returns number found', function () {

    var options = { apiMethod: 'POST' };

    var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
                                                mockAlgoliaParams, mockQueryText, options, 'algolia');

    $httpBackend.expectPOST("https://index.algolianet.com/1/indexes/ecommerce-index/query").respond(200, mockAlgoliaResults);

    searcher.search();

    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    expect(searcher.numFound).toEqual(10);
  });

  it('returns docs', function () {

    var options = { apiMethod: 'POST' };

    var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
                                                mockAlgoliaParams, mockQueryText, options, 'algolia');

    $httpBackend.expectPOST("https://index.algolianet.com/1/indexes/ecommerce-index/query").respond(200, mockAlgoliaResults);

    var called = 0;

    searcher.search()
        .then(function () {

          var docs = searcher.docs;
          expect(docs.length === 28);

          expect(docs[0].title).toEqual("Custom Post-it Notes®");
          expect(docs[0].id).toEqual("postItNotes");
          expect(docs[1].title).toEqual("Postcards");
          expect(docs[1].id).toEqual("postcards");

          called++;
        });

    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();

    expect(called).toEqual(1);
  });

  it('pages on page', function() {
    var searcher = searchSvc.createSearcher(mockFieldSpec, mockAlgoliaUrl,
      mockAlgoliaParams, mockQueryText, { apiMethod: 'POST' }, 'algolia');

    $httpBackend.expectPOST(mockAlgoliaUrl, expectedParams).respond(200, mockAlgoliaResults);
    searcher.search();
    $httpBackend.flush();

    // get page 2
    var nextSearcher = searcher.pager();

    $httpBackend.expectPOST(mockAlgoliaUrl, Object.assign({}, expectedParams, {page: 1}))
    .respond(200, Object.assign({}, mockAlgoliaResults,
      { page: 1 }));

    nextSearcher.search();
    $httpBackend.flush();

    // done
    nextSearcher = nextSearcher.pager();
    expect(nextSearcher).toBe(null);
  });
});

'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Service: searchSvc: Vectara', function() {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  let searcher;
  let searchSvc;
  let vectaraUrlSvc;
  let $httpBackend;
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

  beforeEach(inject(function($injector) {
    $httpBackend = $injector.get('$httpBackend');
  }));

  beforeEach(inject(function (_searchSvc_, _fieldSpecSvc_, _vectaraUrlSvc_) {
    searchSvc     = _searchSvc_;
    fieldSpecSvc  = _fieldSpecSvc_;
    vectaraUrlSvc = _vectaraUrlSvc_;
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field1 field2');
  }));


  var mockVectaraResults = {
    responseSet: [ {
      response: [
          // ignored and omitted here, the response contains the extracted matches, but in splainer we only evaluate
          // use the information from the documents array below
      ],
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
  }

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

    it('returns docs', function () {
      $httpBackend.expectPOST(mockVectaraUrl).respond(200, mockVectaraResults);

      var called = 0;

      searcher.search()
          .then(function () {
            var docs = searcher.docs;
            expect(docs.length === 2);

            expect(docs[0].field1).toEqual("1--field1 value");
            expect(docs[0].field2).toEqual("1--field2 value");
            expect(docs[1].field1).toEqual("2--field1 value");
            expect(docs[1].field2).toEqual("2--field2 value");
            called++;
          });

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
      expect(called).toEqual(1);
    });

  });

});

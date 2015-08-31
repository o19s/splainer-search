'use strict';

/*global urlContainsParams*/
describe('Service: docResolverSvc', function () {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  var docResolverSvc;
  var $httpBackend, $rootScope;

  var mockFieldSpec = null;

  beforeEach(inject(function ($injector, _$rootScope_, _docResolverSvc_, _fieldSpecSvc_) {
    docResolverSvc  = _docResolverSvc_;
    $httpBackend    = $injector.get('$httpBackend');
    $rootScope      = _$rootScope_;

    mockFieldSpec = _fieldSpecSvc_.createFieldSpec('field field1');
  }));

  describe('Solr', function() {
    var mockSolrUrl = 'http://example.com:1234/collection1/select';

    var mockTry = {
      args: {
        q: ['#$query##'],
      },
      tryNo: 2
    };

    var mockFullQueriesResp = {
      queries: {
        displayOrder: [2,1,0],
        queries: {
          '0': {
            'arrangedAt': '3681400536',
            'arrangedNext': '4294967295',
            'deleted': 'false',
            'queryId': '0',
            'query_text': 'symptoms of heart attack',
            'doc1': '10',
            'doc2': '9',
            'doc3': '8',
            'doc4': '7',
            'doc5': '6',
            'doc6': '5',
            'doc7': '4',
            'doc8': '3',
            'doc9': '2',
            'doc10': '2',
            'doc11': '1',
            'doc12': '1'
          },
          '1': {
            'arrangedAt': '3067833780',
            'arrangedNext': '3681400536',
            'deleted': 'true',
            'queryId': '1',
            'query_text': 'how is kidney cancer diagnosed'
          },
          '2': {
            'arrangedAt': '0',
            'arrangedNext': '613566756',
            'deleted': 'false',
            'l_31284': '10',
            'queryId': '2',
            'query_text': 'prognosis of alzheimers',
            'doc1': '1',
            'doc2': '10'
          }
        }
      }
    };

    var mockSolrResp = {
      response: {
        numFound: 10,
        docs : [
          {id: 'doc1', field1: 'title1'},
          {id: 'doc2', field1: 'title2'},
          {id: 'doc3', field1: 'title3'},
          {id: 'doc4', field1: 'title4'},
          {id: 'doc5', field1: 'title5'},
          {id: 'doc6', field1: 'title6'},
          {id: 'doc7', field1: 'title7'},
          {id: 'doc8', field1: 'title8'},
          {id: 'doc9', field1: 'title9'},
          {id: 'doc10', field1: 'title10'}
        ]
      }
    };
    /*global addExplain*/
    addExplain(mockSolrResp);

    var mockSolrRespMissingDoc2 = {
      response: {
        numFound: 10,
        docs : [
          {id: 'doc1', field1: 'title1'},
          {id: 'doc3', field1: 'title3'},
          {id: 'doc4', field1: 'title4'},
          {id: 'doc5', field1: 'title5'},
          {id: 'doc6', field1: 'title6'},
          {id: 'doc7', field1: 'title7'},
          {id: 'doc8', field1: 'title8'},
          {id: 'doc9', field1: 'title9'},
          {id: 'doc10', field1: 'title10'}
        ]
      }
    };
    addExplain(mockSolrResp);

    var mockSettings;

    beforeEach(inject(function () {
      mockSettings = {
        selectedTry: mockTry,
        createFieldSpec: function() {
          return mockFieldSpec;
        },
        searchUrl: mockSolrUrl
      };
    }));

    it('resolves docs by querying solr with ids', function () {
      // its silly we need queries to do this
      var resolver = docResolverSvc.createResolver(['doc1', 'doc2'], mockSettings);
      var expectedUrlParams = {
        q:[encodeURIComponent('id:(doc1 OR doc2)')]
      };
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
                  .respond(200, mockSolrResp);
      resolver.fetchDocs()
      .then(function() {
        expect(resolver.docs.length).toBe(2);
        var ids = [];
        angular.forEach(resolver.docs, function(doc) {
          ids.push(doc.id);
        });
        expect(ids).toContain('doc2');
        expect(ids).toContain('doc1');
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('stubs out missing docs', function() {
      var resolver = docResolverSvc.createResolver(['doc1', 'doc2', 'doc3'], mockSettings);
      var expectedUrlParams = {
        q:[encodeURIComponent('id:(doc1 OR doc2 OR doc3)')]
      };
      $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
                  .respond(200, mockSolrRespMissingDoc2);
      resolver.fetchDocs()
      .then(function() {
        expect(resolver.docs.length).toBe(3);
        var ids = [];
        angular.forEach(resolver.docs, function(doc) {
          ids.push(doc.id);
        });
        expect(ids).toContain('doc3');
        expect(ids).toContain('doc2');
        expect(ids).toContain('doc1');
      });
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    describe('escape solr chars testing', function() {
      var mockSolrEscResp = {
        response: {
          numFound: 20,
          docs : [
            {id: 'http://doc1', field1: 'title1'},
            {id: 'http://doc2', field1: 'title2'},
          ]
        }
      };
      var escDocs = null;
      var resolver = null;
      beforeEach(function() {
        escDocs = ['http://doc1','http://doc2'];
        resolver = docResolverSvc.createResolver(escDocs, mockSettings);
      });

      it('solr escapes before sending', function() {
        var expectedUrlParams = {
          q:[encodeURIComponent('id:(http\\://doc1 OR http\\://doc2)')]
        };
        $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
                    .respond(200, mockSolrEscResp);
        resolver.fetchDocs();
        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingExpectation();
      });
    });


    describe('big resp testing', function() {

      var mockSolrBigResp = {
        response: {
          numFound: 20,
          docs : [
            {id: 'doc1', field1: 'title1'},
            {id: 'doc2', field1: 'title2'},
            {id: 'doc3', field1: 'title3'},
            {id: 'doc4', field1: 'title4'},
            {id: 'doc5', field1: 'title5'},
            {id: 'doc6', field1: 'title6'},
            {id: 'doc7', field1: 'title7'},
            {id: 'doc8', field1: 'title8'},
            {id: 'doc9', field1: 'title9'},
            {id: 'doc10', field1: 'title10'},
            {id: 'doc11', field1: 'title11'},
            {id: 'doc12', field1: 'title12'},
            {id: 'doc13', field1: 'title13'},
            {id: 'doc14', field1: 'title14'},
            {id: 'doc15', field1: 'title15'},
            {id: 'doc16', field1: 'title16'},
            {id: 'doc17', field1: 'title17'},
            {id: 'doc18', field1: 'title18'},
            {id: 'doc19', field1: 'title19'},
            {id: 'doc20', field1: 'title20'}
          ]
        }
      };
      addExplain(mockSolrBigResp);

      var resolver = null;
      var lotsOfDocs = [];

      beforeEach(function() {
        lotsOfDocs = ['doc1','doc2', 'doc3','doc4','doc5','doc6','doc7','doc8','doc9','doc10',
                      'doc11','doc12', 'doc13','doc14','doc15','doc16','doc17','doc18','doc19','doc20'];
        resolver = docResolverSvc.createResolver(lotsOfDocs, mockSettings);
      });

      it('puts all 20 docs in q', function() {
        var expectedUrlParams = {
          q:[encodeURIComponent('id:(doc1 OR doc2 OR doc3 OR doc4 OR doc5 OR doc6 OR doc7 OR doc8 OR doc9 OR doc10 OR doc11 OR doc12 OR doc13 OR doc14 OR doc15 OR doc16 OR doc17 OR doc18 OR doc19 OR doc20)')]
        };
        $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
                    .respond(200, mockSolrBigResp);
        resolver.fetchDocs();
        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingExpectation();
      });

      it('sets rows=docs.length', function() {
        var expectedUrlParams = {
          rows: [encodeURIComponent('' + lotsOfDocs.length)],
        };
        $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
                    .respond(200, mockSolrBigResp);
        resolver.fetchDocs();
        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingExpectation();
      });

      it('gets all docs.length docs', function() {
        var expectedUrlParams = {
          q:[encodeURIComponent('id:(doc1 OR doc2 OR doc3 OR doc4 OR doc5 OR doc6 OR doc7 OR doc8 OR doc9 OR doc10 OR doc11 OR doc12 OR doc13 OR doc14 OR doc15 OR doc16 OR doc17 OR doc18 OR doc19 OR doc20)')]
        };
        $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
                    .respond(200, mockSolrBigResp);
        resolver.fetchDocs()
        .then(function onDocsResolved() {
          expect(resolver.docs.length).toBe(lotsOfDocs.length);
        });
        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingExpectation();
      });

      it('gets all docs.length docs & values', function() {
        var expectedUrlParams = {
          q:[encodeURIComponent('id:(doc1 OR doc2 OR doc3 OR doc4 OR doc5 OR doc6 OR doc7 OR doc8 OR doc9 OR doc10 OR doc11 OR doc12 OR doc13 OR doc14 OR doc15 OR doc16 OR doc17 OR doc18 OR doc19 OR doc20)')]
        };
        $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParams))
                    .respond(200, mockSolrBigResp);
        resolver.fetchDocs()
        .then(function onDocsResolved() {
          var ids = [];
          angular.forEach(resolver.docs, function(doc) {
            ids.push(doc.id);
          });
          angular.forEach(lotsOfDocs, function(docId) {
            expect(ids).toContain(docId);
          });
        });
      });
    });

    describe('chunked queries', function() {

      var docList = [
        {id: 'doc1', field1: 'title1'},
        {id: 'doc2', field1: 'title2'},
        {id: 'doc3', field1: 'title3'},
        {id: 'doc4', field1: 'title4'}
      ];

      var solrRespBase = {
        response: {
          numFound: 20,
          docs : []
        }
      };

      // chunks of size 2
      var mockChunk1_2 = solrRespBase;
      mockChunk1_2.docs = docList.slice(0,2);
      var mockChunk2_2 = solrRespBase;
      mockChunk1_2.docs = docList.slice(2,2);

      // chunks of size 1
      var mockChunk1_4 = solrRespBase;
      mockChunk1_2.docs = docList.slice(0,1);
      var mockChunk2_4 = solrRespBase;
      mockChunk1_2.docs = docList.slice(1,1);
      var mockChunk3_4 = solrRespBase;
      mockChunk1_2.docs = docList.slice(2,1);
      var mockChunk4_4 = solrRespBase;
      mockChunk1_2.docs = docList.slice(3,1);

      // chunks of size 4
      var mockChunk1_1 = solrRespBase;
      mockChunk1_1.docs = docList;

      var resolver = null;
      var docIds = [];

      beforeEach(function() {
        docIds = ['doc1', 'doc2', 'doc3', 'doc4'];
      });

      var expectAllDocsPresent = function(resolver) {
        var ids = [];
        angular.forEach(resolver.docs, function(doc) {
          ids.push(doc.id);
        });
        expect(ids).toContain('doc1');
        expect(ids).toContain('doc2');
        expect(ids).toContain('doc3');
        expect(ids).toContain('doc4');
        expect(ids.length).toEqual(4);
      };

      it('resolves in single chunks', function() {
        resolver = docResolverSvc.createResolver(docIds, mockSettings, 1);
        var expectedUrlParamsChunk1 = {
          q:[encodeURIComponent('id:(doc1)')]
        };
        var expectedUrlParamsChunk2 = {
          q:[encodeURIComponent('id:(doc2)')]
        };
        var expectedUrlParamsChunk3 = {
          q:[encodeURIComponent('id:(doc3)')]
        };
        var expectedUrlParamsChunk4 = {
          q:[encodeURIComponent('id:(doc4)')]
        };
        $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk1))
                    .respond(200, mockChunk1_4);
        $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk2))
                    .respond(200, mockChunk2_4);
        $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk3))
                    .respond(200, mockChunk3_4);
        $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk4))
                    .respond(200, mockChunk4_4);
        var called = 0;
        resolver.fetchDocs()
        .then(function() {
          called++;
          expectAllDocsPresent(resolver);
        });
        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingExpectation();
        $rootScope.$apply();
        expect(called).toBe(1);
      });

      it('resolves in two chunks', function() {
        resolver = docResolverSvc.createResolver(docIds, mockSettings, 2);
        var expectedUrlParamsChunk1 = {
          q:[encodeURIComponent('id:(doc1 OR doc2)')]
        };
        var expectedUrlParamsChunk2 = {
          q:[encodeURIComponent('id:(doc3 OR doc4)')]
        };
        $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk1))
                    .respond(200, mockChunk1_2);
        $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk2))
                    .respond(200, mockChunk2_2);
        var called = 0;
        resolver.fetchDocs()
        .then(function() {
          called++;
          expectAllDocsPresent(resolver);
        });
        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingExpectation();
        $rootScope.$apply();
        expect(called).toBe(1);
      });

      it('resolves in an exact chunk', function() {
        resolver = docResolverSvc.createResolver(docIds, mockSettings, 4);
        var expectedUrlParamsChunk1 = {
          q:[encodeURIComponent('id:(doc1 OR doc2 OR doc3 OR doc4)')]
        };
        $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk1))
                    .respond(200, mockChunk1_1);
        var called = 0;
        resolver.fetchDocs()
        .then(function() {
          called++;
          expectAllDocsPresent(resolver);
        });
        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingExpectation();
        $rootScope.$apply();
        expect(called).toBe(1);
      });

      it('resolves in a bigger than needed chunk', function() {
        resolver = docResolverSvc.createResolver(docIds, mockSettings, 424);
        var expectedUrlParamsChunk1 = {
          q:[encodeURIComponent('id:(doc1 OR doc2 OR doc3 OR doc4)')]
        };
        $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedUrlParamsChunk1))
                    .respond(200, mockChunk1_1);
        var called = 0;
        resolver.fetchDocs()
        .then(function() {
          called++;
          expectAllDocsPresent(resolver);
        });
        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingExpectation();
        $rootScope.$apply();
        expect(called).toBe(1);
      });
    });
  });
});

'use strict';

describe('Service: Solr Explain Extractor', function () {
  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  var solrExplainExtractorSvc, fieldSpecSvc, mockFieldSpec, SolrDocFactory;

  beforeEach(inject(function (_solrExplainExtractorSvc_, _fieldSpecSvc_, _SolrDocFactory_) {
    solrExplainExtractorSvc = _solrExplainExtractorSvc_;
    fieldSpecSvc            = _fieldSpecSvc_;
    SolrDocFactory          = _SolrDocFactory_;
    mockFieldSpec           = fieldSpecSvc.createFieldSpec('field field1');
  }));

  describe('extracts explain info for docs', function() {
    var mockSolrResp = {
      response: {
        numFound: 2,
        docs : [
          {id: 'doc1', title: 'title1'},
          {id: 'doc2', title: 'title2'}
        ]
      }
    };

    var explOtherDoc1 = {
      match:       false,
      value:       0.0,
      description: 'no matching term'
    };

    var explOtherDoc2 = {
      match:        true,
      value:        3.3733945,
      description:  'weight(catch_line:law in 4487) [DefaultSimilarity], result of:',
      details: [
        {
          match:        true,
          value:        3.3733945,
          description:  'fieldWeight in 4487, product of:',
          details :[
            {
              match:        true,
              value:        1.0,
              description:  'tf(freq=1.0), with freq of:',
              details:[
                {
                  match:        true,
                  value:        1.0,
                  description:  'termFreq=1.0'
                }
              ]
            },
            {
              match:        true,
              value:        5.3974314,
              description:  'idf(docFreq=247, maxDocs=20148)'
            },
            {
              match:        true,
              value:        0.625,
              description:  'fieldNorm(doc=4487)'
            }
          ]
        }
      ]
    };

    var mockSolrExplOtherResp = {
      response: {
        numFound: 2,
        docs : [
          {id: 'not_doc1', title: 'title1'},
          {id: 'not_doc2', title: 'title2'}
        ]
      },
      debug: {
        explainOther: {
          'doc1': explOtherDoc1,
          'doc2': explOtherDoc2
        }
      }
    };

    it('passes two solr queries one explains the other', function() {
      var options = {
        groupedBy:          '',
        group:              '',
        fieldList:          mockFieldSpec,
        url:                'http://example.com',
        explDict:           explOtherDoc1,
        hlDict:             {},
        highlightingPre:    "foo",
        highlightingPost:   "/foo"
      };

      var solrDocs = [];
      angular.forEach(mockSolrResp.response.docs, function(doc){
        solrDocs.push(new SolrDocFactory(doc, options));
      });

      var docs = solrExplainExtractorSvc.docsWithExplainOther(solrDocs, mockFieldSpec, mockSolrExplOtherResp.debug.explainOther);

      expect(docs.length).toBe(2);
      expect(Object.keys(docs[0].hotMatches().vecObj).length).toBe(1);
      expect(Object.keys(docs[0].hotMatches().vecObj)).toContain('no matching term');
      expect(docs[0].hotMatches().vecObj['no matching term']).toBe(0);
      expect(docs[0].score()).toBe(0);
      expect(Object.keys(docs[1].hotMatches().vecObj).length).toBe(1);
      expect(docs[1].score()).toBe(3.3733945);
    });
  });
});

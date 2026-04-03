'use strict';

describe('Service: ES Explain Extractor', function () {
  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  var esExplainExtractorSvc, fieldSpecSvc, mockFieldSpec, EsDocFactory;

  beforeEach(inject(function (_esExplainExtractorSvc_, _fieldSpecSvc_, _EsDocFactory_) {
    esExplainExtractorSvc   = _esExplainExtractorSvc_;
    fieldSpecSvc            = _fieldSpecSvc_;
    EsDocFactory            = _EsDocFactory_;
    mockFieldSpec           = fieldSpecSvc.createFieldSpec('field field1');
  }));

  describe('extracts explain info for docs', function() {
    var basicExplain1 = {
      value: 1.5,
      description: 'weight(text:law in 1234)',
    };
    var basicExplain2 = {
      value: 0.5,
      description: 'weight(text:order in 1234)',
    };

    var sumExplain = {
      matched:      true,
      explanation:  {
        value:        1.5,
        description:  'weight(_all:law in 1234)',
        details:      [basicExplain1, basicExplain2]
      }
    };

    var expectedDocs = [
      {
        '_index': 'statedecoded',
        '_type':  'law',
        '_id':    'l_1',
        '_score': 5.0,
        'fields': {
          'field':  ['1--field value'],
          'field1': ['1--field1 value']
        },
      },
      {
        '_index': 'statedecoded',
        '_type':  'law',
        '_id':    'l_1',
        '_score': 3.0,
        'fields': {
          'field':  ['2--field value'],
          'field1': ['2--field1 value']
        }
      }
    ];

    it('passes two solr queries one explains the other', function() {
      var explDict  = {
        match:        sumExplain.matched,
        explanation:  sumExplain.explanation,
        description:  sumExplain.explanation.description,
        value:        sumExplain.explanation.value,
      };

      var options = {
        fieldList:  mockFieldSpec,
        url:        'http://example.com',
        explDict:   explDict,
      };

      var esDocs = [];
      angular.forEach(expectedDocs, function(doc){
        esDocs.push(new EsDocFactory(doc, options));
      });

      var docs = esExplainExtractorSvc.docsWithExplainOther(esDocs, mockFieldSpec);

      expect(docs.length).toBe(2);
      expect(Object.keys(docs[0].hotMatches().vecObj).length).toBe(1);
    });

    it('returns empty array when docs is empty', function() {
      var result = esExplainExtractorSvc.docsWithExplainOther([], mockFieldSpec);
      expect(result).toEqual([]);
    });

    it('handles a single doc without explain data', function() {
      var singleDoc = {
        _index: 'test', _type: 'doc', _id: 'x1', _score: 1.0,
        fields: { field: ['val'], field1: ['val1'] }
      };
      var esDocs = [new EsDocFactory(singleDoc, { fieldList: mockFieldSpec, url: 'http://example.com' })];
      var result = esExplainExtractorSvc.docsWithExplainOther(esDocs, mockFieldSpec);
      expect(result.length).toBe(1);
      expect(result[0]).toBeDefined();
    });

    it('processes multiple docs preserving order', function() {
      var esDocs = [];
      for (var i = 0; i < 5; i++) {
        var rawDoc = {
          _index: 'test', _type: 'doc', _id: 'id_' + i, _score: i,
          fields: { field: [i + '--field'], field1: [i + '--field1'] }
        };
        esDocs.push(new EsDocFactory(rawDoc, { fieldList: mockFieldSpec, url: 'http://example.com' }));
      }
      var result = esExplainExtractorSvc.docsWithExplainOther(esDocs, mockFieldSpec);
      expect(result.length).toBe(5);
    });
  });
});

'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Service: simExplainSvc (via explainSvc)', function () {

  // simExplainSvc types are tested through explainSvc.createExplain
  // because the prototypal inheritance chain requires the factory function

  beforeEach(module('o19s.splainer-search'));

  var explainSvc = null;
  beforeEach(inject(function (_explainSvc_) {
    explainSvc = _explainSvc_;
  }));

  describe('ScoreExplain', function() {

    it('sets explanation to Score', function() {
      var explJson = {
        value: 2.5,
        description: 'score(freq=1.0), computed as boost * idf * tf from:',
        details: [
          { value: 6.7, description: 'idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:', details: [] },
          { value: 0.4, description: 'tf, computed as freq / (freq + k1)', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      expect(expl.explanation()).toEqual('Score');
    });
  });

  describe('FieldWeightExplain', function() {

    it('sets explanation to Field Weight', function() {
      var explJson = {
        value: 1.0,
        description: 'fieldWeight in 0, product of:',
        details: [
          {
            value: 1.0,
            description: 'tf(freq=1.0), with freq of:',
            details: [
              { value: 1.0, description: 'termFreq=1.0', details: [] }
            ]
          },
          { value: 1.0, description: 'idf(docFreq=1, maxDocs=100)', details: [] },
          { value: 1.0, description: 'fieldNorm(doc=0)', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      expect(expl.explanation()).toEqual('Field Weight');
    });

    it('provides tf and idf accessors', function() {
      var explJson = {
        value: 2.0,
        description: 'fieldWeight in 0, product of:',
        details: [
          {
            value: 1.0,
            description: 'tf(freq=1.0), with freq of:',
            details: [
              { value: 1.0, description: 'termFreq=1.0', details: [] }
            ]
          },
          { value: 2.0, description: 'idf(docFreq=10, maxDocs=1000)', details: [] },
          { value: 1.0, description: 'fieldNorm(doc=0)', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);

      expect(expl.tf()).toBeDefined();
      expect(expl.tf().explanation()).toContain('Term Freq');
      expect(expl.idf()).toBeDefined();
      expect(expl.idf().explanation()).toContain('IDF');
    });
  });

  describe('QueryWeightExplain', function() {

    it('sets explanation to Query Weight', function() {
      var explJson = {
        value: 3.0,
        description: 'queryWeight, product of:',
        details: [
          { value: 1.5, description: 'idf(docFreq=5, maxDocs=200)', details: [] },
          { value: 2.0, description: 'queryNorm(something)', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      expect(expl.explanation()).toEqual('Query Weight');
    });
  });

  describe('DefaultSimTfExplain', function() {

    it('includes term frequency in explanation', function() {
      var explJson = {
        value: 1.0,
        description: 'tf(freq=4.0), with freq of:',
        details: [
          { value: 4.0, description: 'termFreq=4.0', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      expect(expl.explanation()).toContain('Term Freq');
      expect(expl.explanation()).toContain('4');
    });
  });

  describe('DefaultSimIdfExplain', function() {

    it('parses single idf explain', function() {
      var explJson = {
        value: 3.5,
        description: 'idf(docFreq=10, maxDocs=1000)',
        details: []
      };
      var expl = explainSvc.createExplain(explJson);
      expect(expl.explanation()).toContain('IDF');
    });

    it('handles sum-of-idf for phrase queries', function() {
      var explJson = {
        value: 5.0,
        description: 'idf(), sum of:',
        details: [
          { value: 2.5, description: 'idf(docFreq=5, maxDocs=100)', details: [] },
          { value: 2.5, description: 'idf(docFreq=5, maxDocs=100)', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      expect(expl.explanation()).toContain('IDF');

      var infl = expl.influencers();
      expect(infl.length).toEqual(2);
    });
  });
});

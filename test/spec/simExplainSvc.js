'use strict';

describe('Service: simExplainSvc (via explainSvc)', function () {

  // simExplainSvc types are tested through explainSvc.createExplain
  // because the prototypal inheritance chain requires the factory function

  beforeEach(module('o19s.splainer-search'));

  var explainSvc = null;
  var simExplainSvc = null;
  beforeEach(inject(function (_explainSvc_, _simExplainSvc_) {
    explainSvc = _explainSvc_;
    simExplainSvc = _simExplainSvc_;
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

  describe('DefaultSimilarityMatch', function() {

    function weightChild(label, tfContrib, idfContrib) {
      return {
        explanation: function() { return label; },
        tf: function() { return { contribution: function() { return tfContrib; } }; },
        idf: function() { return { contribution: function() { return idfContrib; } }; },
        children: []
      };
    }

    it('builds formulaStr from field weight tf/idf contributions', function() {
      var fw = weightChild('Field Weight', 1.25, 3.5);
      var qw = weightChild('Query Weight', 9, 9);
      var match = new simExplainSvc.DefaultSimilarityMatch([fw, qw]);

      expect(match.fieldWeight).toBe(fw);
      expect(match.queryWeight).toBe(qw);
      expect(match.formulaStr()).toEqual('TF=1.25 * IDF=3.5');
    });

    it('unwraps a single Score root to read field/query weights from its children', function() {
      var fw = weightChild('Field Weight', 2, 4);
      var qw = weightChild('Query Weight', 0, 0);
      var scoreRoot = {
        explanation: function() { return 'Score total'; },
        children: [fw, qw]
      };
      var match = new simExplainSvc.DefaultSimilarityMatch([scoreRoot]);

      expect(match.fieldWeight).toBe(fw);
      expect(match.queryWeight).toBe(qw);
      expect(match.formulaStr()).toEqual('TF=2 * IDF=4');
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

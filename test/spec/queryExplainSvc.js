'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Service: queryExplainSvc (via explainSvc)', function () {

  // queryExplainSvc types are tested through explainSvc.createExplain
  // because the prototypal inheritance chain requires the factory function

  beforeEach(module('o19s.splainer-search'));

  var explainSvc = null;
  beforeEach(inject(function (_explainSvc_) {
    explainSvc = _explainSvc_;
  }));

  describe('WeightExplain', function() {

    it('is identified as a weight explain with hasMatch', function() {
      var explJson = {
        value: 2.5,
        description: 'weight(text:foo in 1234) [DefaultSimilarity], result of:',
        details: []
      };
      var expl = explainSvc.createExplain(explJson);
      expect(expl.hasMatch()).toBe(true);
    });

    it('strips trailing product-of from realExplanation', function() {
      // Build a realistic WeightExplain with full child structure so
      // explanation() can call getMatch().formulaStr() without error.
      var explJson = {
        value: 1.0,
        description: 'weight(text:bar in 5678) [DefaultSimilarity], product of:',
        details: [
          {
            value: 0.5,
            description: 'fieldWeight in 0, product of:',
            details: [
              { value: 1.0, description: 'tf(freq=1.0), with freq of:', details: [
                { value: 1.0, description: 'termFreq=1.0', details: [] }
              ]},
              { value: 0.5, description: 'idf(docFreq=10, maxDocs=100)', details: [] }
            ]
          },
          {
            value: 2.0,
            description: 'queryWeight, product of:',
            details: [
              { value: 1.0, description: 'idf(docFreq=10, maxDocs=100)', details: [] }
            ]
          }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      // The public explanation() is safe to call with full child structure
      var explanation = expl.explanation();
      expect(explanation).not.toContain(', product of:');
    });

    it('returns matchDetails as an object', function() {
      var explJson = {
        value: 3.0,
        description: 'weight(title:test in 100) [BM25Similarity], result of:',
        details: [
          { value: 3.0, description: 'score(freq=1.0), computed as boost * idf * tf from:', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      var details = expl.matchDetails();
      expect(details).toBeDefined();
      expect(typeof details).toEqual('object');
    });
  });

  describe('FunctionQueryExplain', function() {

    it('extracts function name from FunctionQuery description', function() {
      var explJson = {
        value: 5.0,
        description: 'FunctionQuery(popularity)',
        details: []
      };
      var expl = explainSvc.createExplain(explJson);
      expect(expl.explanation()).toEqual('popularity');
    });

    it('falls back to full description when regex does not match', function() {
      var explJson = {
        value: 1.0,
        description: 'FunctionQuery(popularity)',
        details: []
      };
      var expl = explainSvc.createExplain(explJson);
      // Regex extracts 'popularity' from 'FunctionQuery(popularity)'
      expect(expl.explanation()).toEqual('popularity');

      // When parens are missing, description.startsWith('FunctionQuery')
      // still matches, but regex fails — falls back to raw description
      var noParens = {
        value: 1.0,
        description: 'FunctionQuery no_parens_here',
        details: []
      };
      var expl2 = explainSvc.createExplain(noParens);
      expect(expl2.explanation()).toEqual('FunctionQuery no_parens_here');
    });
  });

  describe('SumExplain', function() {

    it('returns influencers sorted by score descending', function() {
      var explJson = {
        value: 3.0,
        description: 'sum of',
        details: [
          { value: 0.5, description: 'low', details: [] },
          { value: 2.0, description: 'high', details: [] },
          { value: 0.5, description: 'also low', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      var infl = expl.influencers();

      expect(infl.length).toEqual(3);
      expect(infl[0].contribution()).toEqual(2.0);
      expect(infl[1].contribution()).toEqual(0.5);
    });

    it('flattens nested sum explains', function() {
      var explJson = {
        value: 3.0,
        description: 'sum of',
        details: [
          {
            value: 2.0,
            description: 'inner sum of',
            details: [
              { value: 1.2, description: 'inner a', details: [] },
              { value: 0.8, description: 'inner b', details: [] }
            ]
          },
          { value: 1.0, description: 'outer', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      var infl = expl.influencers();

      // Inner sum should be flattened: inner a, inner b, outer = 3 items
      expect(infl.length).toEqual(3);
    });

    it('vectorizes as sum of child vectors', function() {
      var explJson = {
        value: 3.0,
        description: 'sum of',
        details: [
          { value: 1.0, description: 'match A', details: [] },
          { value: 2.0, description: 'match B', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      var vec = expl.vectorize();

      expect(vec.get('match A')).toEqual(1.0);
      expect(vec.get('match B')).toEqual(2.0);
    });
  });

  describe('ProductExplain', function() {

    it('returns influencers sorted by score descending', function() {
      var explJson = {
        value: 6.0,
        description: 'product of:',
        details: [
          { value: 2.0, description: 'factor a', details: [] },
          { value: 3.0, description: 'factor b', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      var infl = expl.influencers();

      expect(infl.length).toEqual(2);
      expect(infl[0].contribution()).toEqual(3.0);
      expect(infl[1].contribution()).toEqual(2.0);
    });

    it('vectorizes with cross-multiplication scaling', function() {
      var explJson = {
        value: 6.0,
        description: 'product of:',
        details: [
          { value: 2.0, description: 'factor a', details: [] },
          { value: 3.0, description: 'factor b', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      var vec = expl.vectorize();

      // factor a (2.0) scaled by factor b (3.0) = 6.0
      // factor b (3.0) scaled by factor a (2.0) = 6.0
      expect(vec.get('factor a')).toEqual(6.0);
      expect(vec.get('factor b')).toEqual(6.0);
    });
  });

  describe('DismaxExplain', function() {

    it('takes the winner (highest score)', function() {
      var explJson = {
        value: 5.0,
        description: 'max of',
        details: [
          { value: 5.0, description: 'winner', details: [] },
          { value: 2.0, description: 'loser', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      var infl = expl.influencers();

      expect(infl[0].contribution()).toEqual(5.0);
    });

    it('vectorizes to winner only', function() {
      var explJson = {
        value: 5.0,
        description: 'max of',
        details: [
          { value: 5.0, description: 'winner field', details: [] },
          { value: 2.0, description: 'loser field', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      var vec = expl.vectorize();

      expect(vec.get('winner field')).toEqual(5.0);
      expect(vec.get('loser field')).toBeUndefined();
    });
  });

  describe('DismaxTieExplain', function() {

    it('uses tie factor for non-winners', function() {
      var explJson = {
        value: 5.3,
        description: 'max plus 0.1 times others of',
        details: [
          { value: 5.0, description: 'winner', details: [] },
          { value: 3.0, description: 'second', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      var vec = expl.vectorize();

      // winner gets full value, second gets scaled by tie (0.1)
      expect(vec.get('winner')).toEqual(5.0);
      expect(vec.get('second')).toBeCloseTo(0.3, 5);
    });
  });

  describe('MinExplain', function() {

    it('vectorizes to the minimum child', function() {
      var explJson = {
        value: 2.0,
        description: 'Math.min of',
        details: [
          { value: 2.0, description: 'lower', details: [] },
          { value: 100.0, description: 'maxBoost', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);

      // MinExplain returns the minimum influencer's vector
      var vec = expl.vectorize();
      expect(vec.get('lower')).toBeDefined();
    });
  });

  describe('CoordExplain', function() {

    it('scales vectors by coord factor', function() {
      var explJson = {
        value: 1.5,
        description: 'product of:',
        details: [
          { value: 2.0, description: 'sum of', details: [
            { value: 2.0, description: 'match X', details: [] }
          ]},
          { value: 0.75, description: 'coord(1/2)', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);

      // This should be detected as a CoordExplain because one detail starts with 'coord('
      expect(expl.explanation()).toContain('Punished');
    });
  });

  describe('ConstantScoreExplain', function() {

    it('explains as constant scored query', function() {
      var explJson = {
        value: 1.0,
        description: 'ConstantScore(text:foo)',
        details: []
      };
      var expl = explainSvc.createExplain(explJson);
      expect(expl.explanation()).toEqual('Constant Scored Query');
    });
  });

  describe('MatchAllDocsExplain', function() {

    it('explains as match all docs', function() {
      var explJson = {
        value: 1.0,
        description: 'MatchAllDocsQuery, product of:',
        details: []
      };
      var expl = explainSvc.createExplain(explJson);
      expect(expl.explanation()).toContain('Match All Docs');
    });
  });

  describe('EsFieldFunctionQueryExplain', function() {

    it('extracts field name from function description', function() {
      var explJson = {
        value: 0.5,
        description: 'Function for field popularity:',
        details: [
          { value: 0.5, description: 'exp(-0.5 * pow(MAX[0.0, |1.0 - 5.0|],2.0) * 1.0)', details: [] }
        ]
      };
      var expl = explainSvc.createExplain(explJson);
      expect(expl.explanation()).toContain('f(popularity)');
    });
  });

  describe('EsFuncWeightExplain', function() {

    it('explains constant weight function', function() {
      var explJson = {
        value: 5.0,
        description: 'weight',
        details: []
      };
      var expl = explainSvc.createExplain(explJson);
      expect(expl.explanation()).toContain('constant weight');
      expect(expl.explanation()).toContain('5');
    });
  });
});

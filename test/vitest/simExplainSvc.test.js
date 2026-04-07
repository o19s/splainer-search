import { describe, it, expect } from 'vitest';
import { simExplainSvcConstructor } from '../../services/simExplainSvc.js';
import { baseExplainSvcConstructor } from '../../services/baseExplainSvc.js';
import { vectorSvcConstructor } from '../../services/vectorSvc.js';
import utilsSvcStub from './helpers/utilsSvcStub.js';

function createServices() {
  var vectorSvc = new vectorSvcConstructor(utilsSvcStub);
  var baseExplainSvc = new baseExplainSvcConstructor(vectorSvc, utilsSvcStub);
  var simExplainSvc = new simExplainSvcConstructor(utilsSvcStub);
  return { baseExplainSvc, simExplainSvc };
}

describe('simExplainSvc', () => {
  it('creates a ScoreExplain', () => {
    var { simExplainSvc } = createServices();
    var scoreExpl = new simExplainSvc.ScoreExplain();
    expect(scoreExpl.realExplanation).toBe('Score');
  });

  it('creates a FieldWeightExplain with tf/idf accessors', () => {
    var { baseExplainSvc, simExplainSvc } = createServices();
    var json = {
      value: '2.0',
      description: 'fieldWeight',
      details: [
        { value: '1.0', description: 'Term Freq', details: [] },
        { value: '1.0', description: 'IDF Score', details: [] }
      ]
    };
    var factory = function (d) {
      return new baseExplainSvc.Explain(d, factory);
    };
    var expl = new baseExplainSvc.Explain(json, factory);
    // Apply FieldWeightExplain behavior
    simExplainSvc.FieldWeightExplain.call(expl);
    expect(expl.realExplanation).toBe('Field Weight');
  });

  it('creates a QueryWeightExplain', () => {
    var { simExplainSvc } = createServices();
    var expl = { children: [] };
    simExplainSvc.QueryWeightExplain.call(expl);
    expect(expl.realExplanation).toBe('Query Weight');
  });

  it('creates a DefaultSimTfExplain with term frequency', () => {
    var { simExplainSvc } = createServices();
    var expl = { children: [{ contribution: function () { return 4; } }] };
    simExplainSvc.DefaultSimTfExplain.call(expl);
    expect(expl.realExplanation).toBe('Term Freq Score (4)');
  });

  it('parses IDF explain with docFreq/maxDocs regex', () => {
    var { simExplainSvc } = createServices();
    var json = { description: 'idf(docFreq=100, maxDocs=5000)' };
    var expl = { children: [] };
    simExplainSvc.DefaultSimIdfExplain.call(expl, json);
    expect(expl.realExplanation).toBe('IDF Score');
  });

  it('parses sum-of IDF explain with multiple children', () => {
    var { simExplainSvc } = createServices();
    var json = { description: 'sum of:' };
    var expl = { children: [{}, {}] };
    simExplainSvc.DefaultSimIdfExplain.call(expl, json);
    expect(expl.realExplanation).toBe('IDF Score');
    // The sum-of branch installs an `influencers()` getter that returns the children.
    expect(typeof expl.influencers).toBe('function');
    expect(expl.influencers()).toBe(expl.children);
  });

  it('falls through to the raw description when IDF regex does not match', () => {
    var { simExplainSvc } = createServices();
    var json = { description: 'something unrecognized' };
    var expl = { children: [] };
    simExplainSvc.DefaultSimIdfExplain.call(expl, json);
    expect(expl.realExplanation).toBe('something unrecognized');
  });

  it('exposes tf()/idf() accessors via tfIdfable on FieldWeightExplain', () => {
    var { simExplainSvc } = createServices();
    var tfChild = { explanation: function () { return 'Term Frequency'; } };
    var idfChild = { explanation: function () { return 'IDF Score'; } };
    var expl = { children: [tfChild, idfChild] };
    simExplainSvc.FieldWeightExplain.call(expl);
    expect(expl.realExplanation).toBe('Field Weight');
    expect(typeof expl.tf).toBe('function');
    expect(typeof expl.idf).toBe('function');
    expect(expl.tf()).toBe(tfChild);
    expect(expl.idf()).toBe(idfChild);
  });

  describe('DefaultSimilarityMatch', () => {
    // Helper: build a child explain that satisfies the .explanation() / tf() / idf()
    // contract DefaultSimilarityMatch and formulaStr() expect.
    function fakeWeight(label, tfContribution, idfContribution) {
      return {
        explanation: function () { return label; },
        tf: function () { return { contribution: function () { return tfContribution; } }; },
        idf: function () { return { contribution: function () { return idfContribution; } }; },
      };
    }

    it('finds Field Weight and Query Weight among direct children', () => {
      var { simExplainSvc } = createServices();
      var fw = fakeWeight('Field Weight', 0.5, 2);
      var qw = { explanation: function () { return 'Query Weight'; } };
      var match = new simExplainSvc.DefaultSimilarityMatch([fw, qw]);
      expect(match.fieldWeight).toBe(fw);
      expect(match.queryWeight).toBe(qw);
    });

    it('unwraps a single Score child to find the underlying weights', () => {
      var { simExplainSvc } = createServices();
      var fw = fakeWeight('Field Weight', 0.5, 2);
      var qw = { explanation: function () { return 'Query Weight'; } };
      var scoreWrapper = {
        explanation: function () { return 'Score …'; },
        children: [fw, qw],
      };
      var match = new simExplainSvc.DefaultSimilarityMatch([scoreWrapper]);
      expect(match.fieldWeight).toBe(fw);
      expect(match.queryWeight).toBe(qw);
    });

    it('formulaStr() reports TF * IDF using the field weight contributions', () => {
      var { simExplainSvc } = createServices();
      var fw = fakeWeight('Field Weight', 0.5, 2);
      var qw = { explanation: function () { return 'Query Weight'; } };
      var match = new simExplainSvc.DefaultSimilarityMatch([fw, qw]);
      expect(match.formulaStr()).toBe('TF=0.5 * IDF=2');
    });
  });
});

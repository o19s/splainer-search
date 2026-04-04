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
  });
});

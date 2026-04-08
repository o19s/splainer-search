import { describe, it, expect } from 'vitest';
import { baseExplainSvcConstructor } from '../../services/baseExplainSvc.js';
import { vectorSvcConstructor } from '../../services/vectorSvc.js';
import utilsSvcStub from './helpers/utilsSvcStub.js';

function createServices() {
  var vectorSvc = new vectorSvcConstructor(utilsSvcStub);
  var baseExplainSvc = new baseExplainSvcConstructor(vectorSvc, utilsSvcStub);
  return { vectorSvc, baseExplainSvc };
}

describe('baseExplainSvc', () => {
  it('creates an Explain from JSON', () => {
    var { baseExplainSvc } = createServices();
    var json = { value: '3.5', description: 'test explain', details: [] };
    var expl = new baseExplainSvc.Explain(json, function () {
      return null;
    });
    expect(expl.score).toBeCloseTo(3.5);
    expect(expl.description).toBe('test explain');
    expect(expl.children).toEqual([]);
  });

  it('recursively creates child explains', () => {
    var { baseExplainSvc } = createServices();
    var json = {
      value: '5.0',
      description: 'parent',
      details: [
        { value: '2.0', description: 'child1', details: [] },
        { value: '3.0', description: 'child2', details: [] },
      ],
    };
    var factory = function (detail) {
      return new baseExplainSvc.Explain(detail, factory);
    };
    var expl = new baseExplainSvc.Explain(json, factory);
    expect(expl.children.length).toBe(2);
    expect(expl.children[0].score).toBeCloseTo(2.0);
  });

  it('returns contribution and explanation', () => {
    var { baseExplainSvc } = createServices();
    var json = { value: '7.5', description: 'sum of:', details: [] };
    var expl = new baseExplainSvc.Explain(json, function () {
      return null;
    });
    expect(expl.contribution()).toBeCloseTo(7.5);
    expect(expl.explanation()).toBe('sum of:');
  });

  it('vectorizes the explain', () => {
    var { baseExplainSvc } = createServices();
    var json = { value: '4.0', description: 'weight', details: [] };
    var expl = new baseExplainSvc.Explain(json, function () {
      return null;
    });
    var vec = expl.vectorize();
    expect(vec.get('weight')).toBeCloseTo(4.0);
  });

  it('generates a string representation', () => {
    var { baseExplainSvc } = createServices();
    var json = { value: '1.0', description: 'leaf', details: [] };
    var expl = new baseExplainSvc.Explain(json, function () {
      return null;
    });
    var str = expl.toStr();
    expect(str).toContain('1');
    expect(str).toContain('leaf');
  });
});

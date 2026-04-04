import { describe, it, expect } from 'vitest';
import { vectorSvcConstructor } from '../../services/vectorSvc.js';
import utilsSvcStub from './helpers/utilsSvcStub.js';

function createVectorSvc() {
  return new vectorSvcConstructor(utilsSvcStub);
}

describe('vectorSvc', () => {
  it('creates a sparse vector', () => {
    var svc = createVectorSvc();
    var vec = svc.create();
    expect(vec).toBeDefined();
    expect(vec.vecObj).toEqual({});
  });

  it('sets and gets values', () => {
    var svc = createVectorSvc();
    var vec = svc.create();
    vec.set('foo', 10);
    expect(vec.get('foo')).toBe(10);
    expect(vec.get('bar')).toBeUndefined();
  });

  it('adds to existing values', () => {
    var svc = createVectorSvc();
    var vec = svc.create();
    vec.add('x', 5);
    vec.add('x', 3);
    expect(vec.get('x')).toBe(8);
  });

  it('converts to string sorted by value descending', () => {
    var svc = createVectorSvc();
    var vec = svc.create();
    vec.set('low', 1);
    vec.set('high', 10);
    var str = vec.toStr();
    expect(str.indexOf('10 high')).toBeLessThan(str.indexOf('1 low'));
  });

  it('sums two vectors', () => {
    var svc = createVectorSvc();
    var a = svc.create();
    a.set('x', 5);
    var b = svc.create();
    b.set('x', 3);
    var sum = svc.sumOf(a, b);
    expect(sum.get('x')).toBe(8);
  });

  it('scales a vector', () => {
    var svc = createVectorSvc();
    var vec = svc.create();
    vec.set('x', 4);
    var scaled = svc.scale(vec, 3);
    expect(scaled.get('x')).toBe(12);
  });

  it('adds (union) two vectors', () => {
    var svc = createVectorSvc();
    var a = svc.create();
    a.set('x', 5);
    var b = svc.create();
    b.set('y', 3);
    var result = svc.add(a, b);
    expect(result.get('x')).toBe(5);
    expect(result.get('y')).toBe(3);
  });
});

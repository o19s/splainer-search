import { describe, it, expect } from 'vitest';
import { utilsSvcFactory } from '../../services/utilsSvc.js';

function createUtilsSvc() {
  return utilsSvcFactory();
}

describe('utilsSvc', () => {
  describe('safeForEach', () => {
    it('does not invoke the callback for null or undefined', () => {
      var utilsSvc = createUtilsSvc();
      var n = 0;
      utilsSvc.safeForEach(null, function () {
        n++;
      });
      utilsSvc.safeForEach(undefined, function () {
        n++;
      });
      expect(n).toBe(0);
    });

    it('iterates arrays with value, index, and array', () => {
      var utilsSvc = createUtilsSvc();
      var pairs = [];
      utilsSvc.safeForEach(['a', 'b'], function (v, i, arr) {
        pairs.push([v, i, arr]);
      });
      expect(pairs.length).toBe(2);
      expect(pairs[0][0]).toBe('a');
      expect(pairs[0][1]).toBe(0);
      expect(pairs[0][2]).toEqual(['a', 'b']);
      expect(pairs[1][0]).toBe('b');
      expect(pairs[1][1]).toBe(1);
    });

    it('iterates own keys on plain objects', () => {
      var utilsSvc = createUtilsSvc();
      var keys = [];
      utilsSvc.safeForEach({ x: 1, y: 2 }, function (v, k) {
        keys.push(k + '=' + v);
      });
      keys.sort();
      expect(keys).toEqual(['x=1', 'y=2']);
    });

    it('iterates string characters by index', () => {
      var utilsSvc = createUtilsSvc();
      var out = '';
      utilsSvc.safeForEach('ab', function (ch, i) {
        out += i + ch;
      });
      expect(out).toBe('0a1b');
    });

    it('skips inherited prototype properties on objects', () => {
      var utilsSvc = createUtilsSvc();
      var Parent = function () {};
      Parent.prototype.inherited = 'should not appear';
      var obj = new Parent();
      obj.own = 'visible';
      var seen = [];
      utilsSvc.safeForEach(obj, function (v, k) {
        seen.push(k);
      });
      expect(seen).toEqual(['own']);
    });
  });

  describe('deepClone', () => {
    it('returns a deep-independent copy of nested objects', () => {
      var utilsSvc = createUtilsSvc();
      var src = { a: { b: 1 }, c: [2, 3] };
      var copy = utilsSvc.deepClone(src);
      expect(copy).toEqual(src);
      expect(copy).not.toBe(src);
      expect(copy.a).not.toBe(src.a);
      expect(copy.c).not.toBe(src.c);
      copy.a.b = 99;
      expect(src.a.b).toBe(1);
    });

    it('clones arrays', () => {
      var utilsSvc = createUtilsSvc();
      var src = [1, { n: 2 }];
      var copy = utilsSvc.deepClone(src);
      expect(copy).toEqual(src);
      expect(copy).not.toBe(src);
      expect(copy[1]).not.toBe(src[1]);
    });

    it('returns primitives and undefined as expected', () => {
      var utilsSvc = createUtilsSvc();
      expect(utilsSvc.deepClone(7)).toBe(7);
      expect(utilsSvc.deepClone(null)).toBe(null);
      expect(utilsSvc.deepClone(undefined)).toBe(undefined);
    });

    it('falls back to JSON roundtrip for objects containing functions (drops functions)', () => {
      var utilsSvc = createUtilsSvc();
      var src = {
        name: 'test',
        fn: function () {
          return 42;
        },
        data: [1, 2],
      };
      var copy = utilsSvc.deepClone(src);
      expect(copy.name).toBe('test');
      expect(copy.data).toEqual([1, 2]);
      expect(copy.fn).toBeUndefined();
      expect(Object.hasOwn(copy, 'fn')).toBe(false);
    });

    it('drops nested function-valued properties in fallback path', () => {
      var utilsSvc = createUtilsSvc();
      var src = { outer: { inner: 'kept', cb: function () {} } };
      var copy = utilsSvc.deepClone(src);
      expect(copy.outer.inner).toBe('kept');
      expect(Object.hasOwn(copy.outer, 'cb')).toBe(false);
    });

    it('drops undefined values in fallback path (JSON roundtrip limitation)', () => {
      var utilsSvc = createUtilsSvc();
      var src = { a: 1, b: undefined, fn: function () {} };
      var copy = utilsSvc.deepClone(src);
      expect(copy.a).toBe(1);
      expect(Object.hasOwn(copy, 'b')).toBe(false);
    });

    it('preserves undefined values in primary structuredClone path', () => {
      var utilsSvc = createUtilsSvc();
      var src = { a: 1, b: undefined };
      var copy = utilsSvc.deepClone(src);
      expect(copy.a).toBe(1);
      expect(Object.hasOwn(copy, 'b')).toBe(true);
      expect(copy.b).toBeUndefined();
    });
  });

  describe('copyOnto', () => {
    it('replaces destination contents with deep-cloned source', () => {
      var utilsSvc = createUtilsSvc();
      var dest = {};
      var src = { nested: { y: 2 }, add: 3 };
      var out = utilsSvc.copyOnto(dest, src);
      expect(out).toBe(dest);
      expect(dest).toEqual({ nested: { y: 2 }, add: 3 });
      expect(dest.nested).not.toBe(src.nested);
    });

    it('removes pre-existing keys from destination', () => {
      var utilsSvc = createUtilsSvc();
      var dest = { old: 'gone', stale: 99 };
      utilsSvc.copyOnto(dest, { fresh: 'new' });
      expect(dest).toEqual({ fresh: 'new' });
      expect(Object.hasOwn(dest, 'old')).toBe(false);
      expect(Object.hasOwn(dest, 'stale')).toBe(false);
    });

    it('preserves destination object identity', () => {
      var utilsSvc = createUtilsSvc();
      var dest = { x: 1 };
      var ref = dest;
      utilsSvc.copyOnto(dest, { y: 2 });
      expect(dest).toBe(ref);
    });
  });

  describe('deepMerge', () => {
    it('deep-merges nested objects into the target', () => {
      var utilsSvc = createUtilsSvc();
      var target = { a: { b: 1 }, top: 0 };
      var out = utilsSvc.deepMerge(target, { a: { c: 2 }, top: 1 });
      expect(out).toBe(target);
      expect(target).toEqual({ a: { b: 1, c: 2 }, top: 1 });
    });

    it('accepts multiple sources left to right', () => {
      var utilsSvc = createUtilsSvc();
      var target = {};
      utilsSvc.deepMerge(target, { a: 1 }, { b: 2 }, { a: 3 });
      expect(target).toEqual({ a: 3, b: 2 });
    });

    it('matches angular.merge array semantics (index-wise merge)', () => {
      var utilsSvc = createUtilsSvc();
      var target = {};
      utilsSvc.deepMerge(target, { tags: [1, 2, 3] }, { tags: [9] });
      expect(target.tags).toEqual([9, 2, 3]);
    });

    it('overwrites with null from a later source', () => {
      var utilsSvc = createUtilsSvc();
      var target = {};
      var out = utilsSvc.deepMerge(target, { a: { b: 1 } }, { a: null });
      expect(out.a).toBeNull();
    });

    it('skips null and undefined sources without error', () => {
      var utilsSvc = createUtilsSvc();
      var target = { a: 1 };
      utilsSvc.deepMerge(target, null, undefined, { b: 2 });
      expect(target).toEqual({ a: 1, b: 2 });
    });

    it('replaces primitive target value with object source value', () => {
      var utilsSvc = createUtilsSvc();
      var target = { a: 'string' };
      utilsSvc.deepMerge(target, { a: { nested: true } });
      expect(target.a).toEqual({ nested: true });
    });

    it('replaces object target value with primitive source value', () => {
      var utilsSvc = createUtilsSvc();
      var target = { a: { nested: true } };
      utilsSvc.deepMerge(target, { a: 'string' });
      expect(target.a).toBe('string');
    });

    it('deep-clones source values so mutations do not leak', () => {
      var utilsSvc = createUtilsSvc();
      var source = { a: { b: 1 } };
      var target = {};
      utilsSvc.deepMerge(target, source);
      target.a.b = 99;
      expect(source.a.b).toBe(1);
    });
  });

  describe('mergeSearcherConfig', () => {
    it('assigns default config by reference when searcher.config is undefined', () => {
      var utilsSvc = createUtilsSvc();
      var defaults = { a: 1, b: 2 };
      var searcher = {};
      utilsSvc.mergeSearcherConfig(searcher, defaults);
      expect(searcher.config).toBe(defaults);
    });

    it('deep-merges partial config over defaults', () => {
      var utilsSvc = createUtilsSvc();
      var defaults = { a: 1, b: 2, nested: { x: 0 } };
      var searcher = { config: { b: 99, nested: { y: 1 } } };
      utilsSvc.mergeSearcherConfig(searcher, defaults);
      expect(searcher.config).toEqual({ a: 1, b: 99, nested: { x: 0, y: 1 } });
      expect(searcher.config).not.toBe(defaults);
    });
  });

  describe('ensureUrlHasProtocol', () => {
    it('leaves http and https URLs unchanged', () => {
      var utilsSvc = createUtilsSvc();
      expect(utilsSvc.ensureUrlHasProtocol('http://host/solr/c/select')).toBe(
        'http://host/solr/c/select',
      );
      expect(utilsSvc.ensureUrlHasProtocol('https://host/solr/c/select')).toBe(
        'https://host/solr/c/select',
      );
    });

    it('prefixes http when no scheme is present', () => {
      var utilsSvc = createUtilsSvc();
      expect(utilsSvc.ensureUrlHasProtocol('localhost:8983/solr/c/select')).toBe(
        'http://localhost:8983/solr/c/select',
      );
    });
  });
});

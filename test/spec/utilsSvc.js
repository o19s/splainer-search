'use strict';

describe('Service: utilsSvc (migration shims)', function() {
  var utilsSvc;

  beforeEach(module('o19s.splainer-search'));

  beforeEach(inject(function(_utilsSvc_) {
    utilsSvc = _utilsSvc_;
  }));

  describe('safeForEach', function() {
    it('does not invoke the callback for null or undefined', function() {
      var n = 0;
      utilsSvc.safeForEach(null, function() {
        n++;
      });
      utilsSvc.safeForEach(undefined, function() {
        n++;
      });
      expect(n).toBe(0);
    });

    it('iterates arrays with value, index, and array', function() {
      var pairs = [];
      utilsSvc.safeForEach(['a', 'b'], function(v, i, arr) {
        pairs.push([v, i, arr]);
      });
      expect(pairs.length).toBe(2);
      expect(pairs[0][0]).toBe('a');
      expect(pairs[0][1]).toBe(0);
      expect(pairs[0][2]).toEqual(['a', 'b']);
      expect(pairs[1][0]).toBe('b');
      expect(pairs[1][1]).toBe(1);
    });

    it('iterates own keys on plain objects', function() {
      var keys = [];
      utilsSvc.safeForEach({ x: 1, y: 2 }, function(v, k) {
        keys.push(k + '=' + v);
      });
      keys.sort();
      expect(keys).toEqual(['x=1', 'y=2']);
    });

    it('iterates string characters by index', function() {
      var out = '';
      utilsSvc.safeForEach('ab', function(ch, i) {
        out += i + ch;
      });
      expect(out).toBe('0a1b');
    });

    it('skips inherited prototype properties on objects', function() {
      var Parent = function() {};
      Parent.prototype.inherited = 'should not appear';
      var obj = new Parent();
      obj.own = 'visible';
      var seen = [];
      utilsSvc.safeForEach(obj, function(v, k) {
        seen.push(k);
      });
      expect(seen).toEqual(['own']);
    });
  });

  describe('deepClone', function() {
    it('returns a deep-independent copy of nested objects', function() {
      var src = { a: { b: 1 }, c: [2, 3] };
      var copy = utilsSvc.deepClone(src);
      expect(copy).toEqual(src);
      expect(copy).not.toBe(src);
      expect(copy.a).not.toBe(src.a);
      expect(copy.c).not.toBe(src.c);
      copy.a.b = 99;
      expect(src.a.b).toBe(1);
    });

    it('clones arrays', function() {
      var src = [1, { n: 2 }];
      var copy = utilsSvc.deepClone(src);
      expect(copy).toEqual(src);
      expect(copy).not.toBe(src);
      expect(copy[1]).not.toBe(src[1]);
    });

    it('returns primitives and undefined as expected', function() {
      expect(utilsSvc.deepClone(7)).toBe(7);
      expect(utilsSvc.deepClone(null)).toBe(null);
      expect(utilsSvc.deepClone(undefined)).toBe(undefined);
    });

    it('falls back to JSON roundtrip for objects containing functions (drops functions)', function() {
      var src = { name: 'test', fn: function() { return 42; }, data: [1, 2] };
      var copy = utilsSvc.deepClone(src);
      expect(copy.name).toBe('test');
      expect(copy.data).toEqual([1, 2]);
      expect(copy.fn).toBeUndefined();
      expect(Object.hasOwn(copy, 'fn')).toBe(false);
    });

    it('drops nested function-valued properties in fallback path', function() {
      var src = { outer: { inner: 'kept', cb: function() {} } };
      var copy = utilsSvc.deepClone(src);
      expect(copy.outer.inner).toBe('kept');
      expect(Object.hasOwn(copy.outer, 'cb')).toBe(false);
    });

    it('drops undefined values in fallback path (JSON roundtrip limitation)', function() {
      var src = { a: 1, b: undefined, fn: function() {} };
      var copy = utilsSvc.deepClone(src);
      expect(copy.a).toBe(1);
      expect(Object.hasOwn(copy, 'b')).toBe(false);
    });

    it('preserves undefined values in primary structuredClone path', function() {
      var src = { a: 1, b: undefined };
      var copy = utilsSvc.deepClone(src);
      expect(copy.a).toBe(1);
      expect(Object.hasOwn(copy, 'b')).toBe(true);
      expect(copy.b).toBeUndefined();
    });
  });

  describe('copyOnto', function() {
    it('replaces destination contents with deep-cloned source', function() {
      var dest = {};
      var src = { nested: { y: 2 }, add: 3 };
      var out = utilsSvc.copyOnto(dest, src);
      expect(out).toBe(dest);
      expect(dest).toEqual({ nested: { y: 2 }, add: 3 });
      expect(dest.nested).not.toBe(src.nested);
    });

    it('removes pre-existing keys from destination', function() {
      var dest = { old: 'gone', stale: 99 };
      utilsSvc.copyOnto(dest, { fresh: 'new' });
      expect(dest).toEqual({ fresh: 'new' });
      expect(Object.hasOwn(dest, 'old')).toBe(false);
      expect(Object.hasOwn(dest, 'stale')).toBe(false);
    });

    it('preserves destination object identity', function() {
      var dest = { x: 1 };
      var ref = dest;
      utilsSvc.copyOnto(dest, { y: 2 });
      expect(dest).toBe(ref);
    });
  });

  describe('deepMerge', function() {
    it('deep-merges nested objects into the target', function() {
      var target = { a: { b: 1 }, top: 0 };
      var out = utilsSvc.deepMerge(target, { a: { c: 2 }, top: 1 });
      expect(out).toBe(target);
      expect(target).toEqual({ a: { b: 1, c: 2 }, top: 1 });
    });

    it('accepts multiple sources left to right', function() {
      var target = {};
      utilsSvc.deepMerge(target, { a: 1 }, { b: 2 }, { a: 3 });
      expect(target).toEqual({ a: 3, b: 2 });
    });

    it('matches angular.merge array semantics (index-wise merge)', function() {
      var target = {};
      utilsSvc.deepMerge(target, { tags: [1, 2, 3] }, { tags: [9] });
      expect(target.tags).toEqual([9, 2, 3]);
    });

    it('overwrites with null from a later source', function() {
      var target = {};
      var out = utilsSvc.deepMerge(target, { a: { b: 1 } }, { a: null });
      expect(out.a).toBeNull();
    });

    it('skips null and undefined sources without error', function() {
      var target = { a: 1 };
      utilsSvc.deepMerge(target, null, undefined, { b: 2 });
      expect(target).toEqual({ a: 1, b: 2 });
    });

    it('replaces primitive target value with object source value', function() {
      var target = { a: 'string' };
      utilsSvc.deepMerge(target, { a: { nested: true } });
      expect(target.a).toEqual({ nested: true });
    });

    it('replaces object target value with primitive source value', function() {
      var target = { a: { nested: true } };
      utilsSvc.deepMerge(target, { a: 'string' });
      expect(target.a).toBe('string');
    });

    it('deep-clones source values so mutations do not leak', function() {
      var source = { a: { b: 1 } };
      var target = {};
      utilsSvc.deepMerge(target, source);
      target.a.b = 99;
      expect(source.a.b).toBe(1);
    });
  });
});

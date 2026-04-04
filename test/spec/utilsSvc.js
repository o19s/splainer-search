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
  });

  describe('copyOnto', function() {
    it('matches angular.copy(source, destination): replaces destination contents', function() {
      var dest = {};
      var src = { nested: { y: 2 }, add: 3 };
      var out = utilsSvc.copyOnto(dest, src);
      expect(out).toBe(dest);
      expect(dest).toEqual({ nested: { y: 2 }, add: 3 });
      expect(dest.nested).not.toBe(src.nested);
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
  });
});

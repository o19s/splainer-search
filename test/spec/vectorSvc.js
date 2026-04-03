'use strict';

describe('Service: vectorSvc', function () {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  var vectorSvc = null;
  beforeEach(inject(function (_vectorSvc_) {
    vectorSvc = _vectorSvc_;
  }));

  it('sets and gets', function() {
    var vec = vectorSvc.create();
    vec.set('cat', 5);
    expect(vec.get('cat')).toEqual(5);
  });

  it('converts to string', function() {
    var vec = vectorSvc.create();
    vec.set('cat', 5);
    expect(vec.toStr()).toContain('cat');
    expect(vec.toStr()).toContain('5');
  });

  it('merges two vectors via add', function() {
    var vec1 = vectorSvc.create();
    vec1.set('cat', 5);
    var vec2 = vectorSvc.create();
    vec2.set('dog', 7);
    var merged = vectorSvc.add(vec1, vec2);
    expect(merged.get('cat')).toEqual(5);
    expect(merged.get('dog')).toEqual(7);
  });

  it('toStr updates after set', function() {
    var vec = vectorSvc.create();
    vec.set('cat', 5);
    var first = vec.toStr();
    vec.set('dog', 7);
    var second = vec.toStr();
    expect(first).toContain('cat');
    expect(first).not.toContain('dog');
    expect(second).toContain('cat');
    expect(second).toContain('dog');
  });
});

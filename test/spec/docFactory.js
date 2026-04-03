'use strict';

/**
 * Tests for DocFactory: base document wrapper used by engine-specific doc factories.
 */
/*global describe,beforeEach,module,inject,it,expect*/
describe('Factory: DocFactory', function() {
  beforeEach(module('o19s.splainer-search'));

  var DocFactory;

  beforeEach(inject(function(_DocFactory_) {
    DocFactory = _DocFactory_;
  }));

  function makeDoc(opts) {
    var raw = { _source: { a: 1 } };
    return new DocFactory(raw, opts || {});
  }

  it('exposes groupedBy, group, and version from opts or null', function() {
    expect(makeDoc({}).groupedBy()).toBe(null);
    expect(makeDoc({}).group()).toBe(null);
    expect(makeDoc({}).version()).toBe(null);
    var d = makeDoc({ groupedBy: 'cat', group: 'x', version: '7' });
    expect(d.groupedBy()).toBe('cat');
    expect(d.group()).toBe('x');
    expect(d.version()).toBe('7');
  });

  it('options() returns the constructor opts', function() {
    var opts = { foo: 'bar' };
    expect(makeDoc(opts).options()).toBe(opts);
  });

  it('fieldsAttrName is _source and fieldsProperty reads that property', function() {
    var d = makeDoc({});
    expect(d.fieldsAttrName()).toBe('_source');
    expect(d.fieldsProperty()).toEqual({ a: 1 });
  });
});

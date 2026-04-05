import { describe, it, expect } from 'vitest';
import { DocFactory } from '../../factories/docFactory.js';
import { utilsSvcFactory } from '../../services/utilsSvc.js';

var utilsSvc = utilsSvcFactory();
var DocConstructor = DocFactory(utilsSvc);

function makeDoc(opts) {
  var raw = { _source: { a: 1 } };
  return new DocConstructor(raw, opts || {});
}

describe('DocFactory', () => {
  it('exposes groupedBy, group, and version from opts or null', () => {
    expect(makeDoc({}).groupedBy()).toBe(null);
    expect(makeDoc({}).group()).toBe(null);
    expect(makeDoc({}).version()).toBe(null);
    var d = makeDoc({ groupedBy: 'cat', group: 'x', version: '7' });
    expect(d.groupedBy()).toBe('cat');
    expect(d.group()).toBe('x');
    expect(d.version()).toBe('7');
  });

  it('options() returns the constructor opts', () => {
    var opts = { foo: 'bar' };
    expect(makeDoc(opts).options()).toBe(opts);
  });

  it('fieldsAttrName is _source and fieldsProperty reads that property', () => {
    var d = makeDoc({});
    expect(d.fieldsAttrName()).toBe('_source');
    expect(d.fieldsProperty()).toEqual({ a: 1 });
  });
});

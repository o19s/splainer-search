'use strict';

/**
 * Contract tests for String helpers loaded from services/stringPatch.js.
 * Browsers may use native implementations; older environments use the polyfills.
 */
/*global describe,beforeEach,module,it,expect*/
describe('stringPatch (String prototype helpers)', function() {
  beforeEach(module('o19s.splainer-search'));

  it('startsWith returns true only when the string starts with the prefix', function() {
    expect('solr'.startsWith('sol')).toBe(true);
    expect('solr'.startsWith('lr')).toBe(false);
    expect(''.startsWith('x')).toBe(false);
  });

  it('hasSubstr returns true when the substring appears anywhere', function() {
    expect('foo:bar'.hasSubstr(':')).toBe(true);
    expect('abc'.hasSubstr('z')).toBe(false);
  });

  it('endsWith returns true only when the string ends with the suffix', function() {
    expect('query.json'.endsWith('.json')).toBe(true);
    expect('query.json'.endsWith('query')).toBe(false);
  });
});

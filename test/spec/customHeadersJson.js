'use strict';

/* global describe, beforeEach, inject, it, expect, module, spyOn */

describe('Factory: customHeadersJson', function() {

  beforeEach(module('o19s.splainer-search'));

  var customHeadersJson;

  beforeEach(inject(function(_customHeadersJson_) {
    customHeadersJson = _customHeadersJson_;
  }));

  it('returns ok with empty headers for undefined, null, or empty string', function() {
    expect(customHeadersJson.tryParseObject(undefined)).toEqual({ ok: true, headers: {} });
    expect(customHeadersJson.tryParseObject(null)).toEqual({ ok: true, headers: {} });
    expect(customHeadersJson.tryParseObject('')).toEqual({ ok: true, headers: {} });
  });

  it('parses a plain object', function() {
    var r = customHeadersJson.tryParseObject('{"X-Foo":"bar"}');
    expect(r.ok).toBe(true);
    expect(r.headers).toEqual({ 'X-Foo': 'bar' });
  });

  it('returns ok false for invalid JSON and warns', function() {
    spyOn(console, 'warn');
    var r = customHeadersJson.tryParseObject('not-json');
    expect(r.ok).toBe(false);
    expect(r.headers).toEqual({});
    expect(console.warn).toHaveBeenCalled();
  });

  it('returns ok false for JSON array or primitive', function() {
    spyOn(console, 'warn');
    expect(customHeadersJson.tryParseObject('[]').ok).toBe(false);
    expect(customHeadersJson.tryParseObject('"x"').ok).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });
});

'use strict';

/**
 * Tests for vectaraUrlSvc: header parsing for Vectara API requests.
 */
/*global describe,beforeEach,module,inject,it,expect*/
describe('Service: vectaraUrlSvc', function() {
  beforeEach(module('o19s.splainer-search'));

  var vectaraUrlSvc;

  beforeEach(inject(function(_vectaraUrlSvc_) {
    vectaraUrlSvc = _vectaraUrlSvc_;
  }));

  it('returns an empty object when customHeaders is omitted', function() {
    expect(vectaraUrlSvc.getHeaders()).toEqual({});
  });

  it('returns an empty object when customHeaders is empty', function() {
    expect(vectaraUrlSvc.getHeaders('')).toEqual({});
  });

  it('parses JSON customHeaders into a header map', function() {
    var headers = vectaraUrlSvc.getHeaders('{"X-Custom":"1","Authorization":"Bearer t"}');
    expect(headers).toEqual({ 'X-Custom': '1', 'Authorization': 'Bearer t' });
  });

  it('returns empty object when customHeaders is not valid JSON', function() {
    spyOn(console, 'warn');
    expect(vectaraUrlSvc.getHeaders('not-json')).toEqual({});
    expect(console.warn).toHaveBeenCalled();
  });
});

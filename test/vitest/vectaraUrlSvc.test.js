import { describe, it, expect, vi, afterEach } from 'vitest';
import { vectaraUrlSvcConstructor } from '../../services/vectaraUrlSvc.js';
import { tryParseObject } from '../../services/customHeadersJson.js';

// Angular DI injects customHeadersJson as { tryParseObject }, not the bare function
var customHeadersJson = { tryParseObject: tryParseObject };

function createVectaraUrlSvc() {
  return new vectaraUrlSvcConstructor(customHeadersJson);
}

describe('vectaraUrlSvc', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty object when customHeaders is omitted', () => {
    var vectaraUrlSvc = createVectaraUrlSvc();
    expect(vectaraUrlSvc.getHeaders()).toEqual({});
  });

  it('returns an empty object when customHeaders is empty', () => {
    var vectaraUrlSvc = createVectaraUrlSvc();
    expect(vectaraUrlSvc.getHeaders('')).toEqual({});
  });

  it('parses JSON customHeaders into a header map', () => {
    var vectaraUrlSvc = createVectaraUrlSvc();
    var headers = vectaraUrlSvc.getHeaders('{"X-Custom":"1","Authorization":"Bearer t"}');
    expect(headers).toEqual({ 'X-Custom': '1', Authorization: 'Bearer t' });
  });

  it('returns empty object when customHeaders is not valid JSON', () => {
    var vectaraUrlSvc = createVectaraUrlSvc();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(vectaraUrlSvc.getHeaders('not-json')).toEqual({});
    expect(console.warn).toHaveBeenCalled();
  });
});

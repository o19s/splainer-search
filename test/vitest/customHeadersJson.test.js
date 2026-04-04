import { describe, it, expect, vi } from 'vitest';
import { tryParseObject } from '../../services/customHeadersJson.js';

describe('customHeadersJson.tryParseObject', () => {
  it('returns ok with empty headers for null', () => {
    expect(tryParseObject(null)).toEqual({ ok: true, headers: {} });
  });

  it('returns ok with empty headers for undefined', () => {
    expect(tryParseObject(undefined)).toEqual({ ok: true, headers: {} });
  });

  it('returns ok with empty headers for empty string', () => {
    expect(tryParseObject('')).toEqual({ ok: true, headers: {} });
  });

  it('returns ok with empty headers for non-string', () => {
    expect(tryParseObject(42)).toEqual({ ok: true, headers: {} });
  });

  it('parses a valid JSON object', () => {
    var json = '{"X-Custom": "value"}';
    var result = tryParseObject(json);
    expect(result.ok).toBe(true);
    expect(result.headers).toEqual({ 'X-Custom': 'value' });
  });

  it('rejects a JSON array with ok=false', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    var result = tryParseObject('[1,2]');
    expect(result.ok).toBe(false);
    expect(result.headers).toEqual({});
    console.warn.mockRestore();
  });

  it('rejects invalid JSON with ok=false', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    var result = tryParseObject('{bad json');
    expect(result.ok).toBe(false);
    expect(result.headers).toEqual({});
    console.warn.mockRestore();
  });

  it('rejects a JSON primitive with ok=false', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    var result = tryParseObject('"just a string"');
    expect(result.ok).toBe(false);
    expect(result.headers).toEqual({});
    console.warn.mockRestore();
  });
});

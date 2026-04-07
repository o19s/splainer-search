import { describe, it, expect } from 'vitest';
import { isAbortError, transportRequestOpts } from '../../services/transportRequestOpts.js';

describe('transportRequestOpts', function () {
  it('returns empty object when config has no signal', function () {
    expect(transportRequestOpts({})).toEqual({});
    expect(transportRequestOpts(null)).toEqual({});
  });

  it('returns { signal } when config.signal is set', function () {
    var ac = new AbortController();
    expect(transportRequestOpts({ signal: ac.signal })).toEqual({ signal: ac.signal });
  });
});

describe('isAbortError', function () {
  it('returns true for AbortError by name', function () {
    var e = new Error('x');
    e.name = 'AbortError';
    expect(isAbortError(e)).toBe(true);
  });

  it('returns false for other errors', function () {
    expect(isAbortError(new Error('nope'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

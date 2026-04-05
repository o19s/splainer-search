'use strict';

/**
 * Safe parsing of user-provided `customHeaders` JSON (object maps for HTTP headers).
 * Centralizes try/catch so {@link esUrlSvc}, {@link vectaraUrlSvc}, and {@link searchSvc}
 * do not throw {@link SyntaxError} on bad input.
 */

/**
 * Parses a JSON string into a plain object suitable for header maps.
 *
 * @param {string} [jsonString]
 * @returns {{ ok: boolean, headers: Object }} `ok` is false when the input is
 *   non-empty but not valid JSON, or JSON that is not a plain object (e.g. array
 *   or primitive). On failure, `headers` is always `{}`.
 */
export function tryParseObject(jsonString) {
  if (jsonString === undefined || jsonString === null) {
    return { ok: true, headers: {} };
  }
  var s = jsonString;
  if (typeof s !== 'string' || s.length === 0) {
    return { ok: true, headers: {} };
  }
  try {
    var o = JSON.parse(s);
    if (o !== null && typeof o === 'object' && !Array.isArray(o)) {
      return { ok: true, headers: o };
    }
    console.warn('splainer-search: customHeaders must be a JSON object; using empty headers.');
    return { ok: false, headers: {} };
  } catch (err) {
    console.warn('splainer-search: invalid customHeaders JSON; using empty headers.', err);
    return { ok: false, headers: {} };
  }
}


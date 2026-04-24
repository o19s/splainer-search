'use strict';

/**
 * Build optional fetch options for transport `.query(..., requestOpts)` from a
 * searcher `config` object (same object passed to `searchSvc.createSearcher` as `config`).
 *
 * @param {object} [config]
 * @returns {{ signal?: AbortSignal }}
 */
export function transportRequestOpts(config) {
  if (config && config.signal !== undefined && config.signal !== null) {
    return { signal: config.signal };
  }
  return {};
}

/**
 * @param {*} err
 * @returns {boolean}
 */
export function isAbortError(err) {
  return Boolean(err && err.name === 'AbortError');
}

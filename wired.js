/**
 * Pre-wired Splainer / Quepid API (ESM subpath: `splainer-search/wired.js`).
 *
 * Use this entry when you need the same **service names and create* helpers** as the
 * legacy Angular bundle / Quepid vendored build (`fieldSpecSvc`, `searchSvc`,
 * `createSearcher`, …), instead of importing `*Constructor` symbols from the root
 * package and wiring dependencies yourself.
 *
 * **Custom `fetch` (cookies, CSRF, tests):** call {@link createWiredServices} with
 * `createFetchClient({ fetch: myFetch })`. For the default global `fetch`, use
 * {@link getDefaultWiredServices} or the top-level {@link createSearcher} /
 * {@link createFieldSpec} / {@link createNormalDoc} helpers.
 *
 * @module splainer-search/wired
 */
'use strict';

import { createFetchClient } from './services/httpClient.js';
import { createWiredServices } from './wired/wiring.js';

export { createWiredServices } from './wired/wiring.js';
export { createFetchClient } from './services/httpClient.js';

export { activeQueries } from './values/activeQueries.js';
export { defaultSolrConfig } from './values/defaultSolrConfig.js';
export { defaultESConfig } from './values/defaultESConfig.js';
export { defaultVectaraConfig } from './values/defaultVectaraConfig.js';

var _defaultWired;

/**
 * Lazily built graph using `createFetchClient()` (global `fetch` / JSONP defaults).
 * Prefer {@link createWiredServices} when you need a custom HTTP client.
 *
 */
export function getDefaultWiredServices() {
  if (!_defaultWired) {
    _defaultWired = createWiredServices(createFetchClient());
  }
  return _defaultWired;
}

/**
 * @param {object|Function} [options] - Passed through to {@link createFetchClient}.
 */
export function createWiredServicesWithFetch(options) {
  return createWiredServices(createFetchClient(options));
}

/** @see getDefaultWiredServices */
export function createSearcher() {
  var s = getDefaultWiredServices().searchSvc;
  return s.createSearcher.apply(s, arguments);
}

/** @see getDefaultWiredServices */
export function createFieldSpec() {
  var f = getDefaultWiredServices().fieldSpecSvc;
  return f.createFieldSpec.apply(f, arguments);
}

/** @see getDefaultWiredServices */
export function createNormalDoc() {
  var n = getDefaultWiredServices().normalDocsSvc;
  return n.createNormalDoc.apply(n, arguments);
}

/**
 * Live bindings to the default wired graph (lazy). Use when migrating from
 * `import { fieldSpecSvc, searchSvc } from 'splainer-search'`.
 */
export const wired = {};

function defineLazyWiredProp(name) {
  Object.defineProperty(wired, name, {
    configurable: true,
    enumerable: true,
    get: function () {
      return getDefaultWiredServices()[name];
    },
  });
}

[
  'fieldSpecSvc',
  'searchSvc',
  'normalDocsSvc',
  'solrUrlSvc',
  'esUrlSvc',
  'vectaraUrlSvc',
  'esExplainExtractorSvc',
  'solrExplainExtractorSvc',
  'docResolverSvc',
  'utilsSvc',
  'explainSvc',
  'vectorSvc',
  'queryTemplateSvc',
  'settingsValidatorFactory',
  'transportSvc',
].forEach(defineLazyWiredProp);

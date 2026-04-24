/**
 * Manual dependency wiring for Vitest tests — replaces Angular DI.
 *
 * Delegates to the same graph as {@link ../../../../wired/wiring.js#createWiredServices}
 * (and the public `splainer-search/wired.js` entry). Each getter returns the same
 * object shape Angular would inject, cached per HTTP client instance.
 */
'use strict';

import { createFetchClient } from '../../../services/httpClient.js';
import { createWiredServices } from '../../../wired/wiring.js';

var NOOP_HTTP_CLIENT = createFetchClient({
  fetch: function () {
    return Promise.reject(new Error('splainer-search test helper: unused HTTP client'));
  },
});

var _wiredCache = new WeakMap();

function wiredFor(httpClient) {
  var key = httpClient === undefined || httpClient === null ? NOOP_HTTP_CLIENT : httpClient;
  var g = _wiredCache.get(key);
  if (!g) {
    g = createWiredServices(key);
    _wiredCache.set(key, g);
  }
  return g;
}

export function getUtilsSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).utilsSvc;
}

export function getCustomHeadersJson() {
  return wiredFor(NOOP_HTTP_CLIENT).customHeadersJson;
}

export function getVectorSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).vectorSvc;
}

export function getFieldSpecSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).fieldSpecSvc;
}

export function getSolrUrlSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).solrUrlSvc;
}

export function getEsUrlSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).esUrlSvc;
}

export function getVectaraUrlSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).vectaraUrlSvc;
}

export function getQueryTemplateSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).queryTemplateSvc;
}

export function getBaseExplainSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).baseExplainSvc;
}

export function getSimExplainSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).simExplainSvc;
}

export function getQueryExplainSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).queryExplainSvc;
}

export function getExplainSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).explainSvc;
}

export function getNormalDocsSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).normalDocsSvc;
}

export function getEsExplainExtractorSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).esExplainExtractorSvc;
}

export function getSolrExplainExtractorSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).solrExplainExtractorSvc;
}

export function getEsSearcherPreprocessorSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).esSearcherPreprocessorSvc;
}

export function getSolrSearcherPreprocessorSvc(overrideDefaultConfig) {
  return wiredFor(NOOP_HTTP_CLIENT).createSolrSearcherPreprocessorSvc(overrideDefaultConfig);
}

export function getVectaraSearcherPreprocessorSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).vectaraSearcherPreprocessorSvc;
}

export function getAlgoliaSearcherPreprocessorSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).algoliaSearcherPreprocessorSvc;
}

export function getSearchApiSearcherPreprocessorSvc() {
  return wiredFor(NOOP_HTTP_CLIENT).searchApiSearcherPreprocessorSvc;
}

export function getDocConstructor() {
  return wiredFor(NOOP_HTTP_CLIENT).docConstructor;
}

export function getEsDocConstructor() {
  return wiredFor(NOOP_HTTP_CLIENT).esDocConstructor;
}

export function getSolrDocConstructor() {
  return wiredFor(NOOP_HTTP_CLIENT).solrDocConstructor;
}

export function getVectaraDocConstructor() {
  return wiredFor(NOOP_HTTP_CLIENT).vectaraDocConstructor;
}

export function getAlgoliaDocConstructor() {
  return wiredFor(NOOP_HTTP_CLIENT).algoliaDocConstructor;
}

export function getSearchApiDocConstructor() {
  return wiredFor(NOOP_HTTP_CLIENT).searchApiDocConstructor;
}

export function getTransportConstructor() {
  return wiredFor(NOOP_HTTP_CLIENT).transportConstructor;
}

export function getSearcherConstructor() {
  return wiredFor(NOOP_HTTP_CLIENT).searcherConstructor;
}

export function getHttpGetTransportFactory(httpClient) {
  return wiredFor(httpClient).httpGetTransportFactory;
}

export function getHttpPostTransportFactory(httpClient) {
  return wiredFor(httpClient).httpPostTransportFactory;
}

export function getHttpJsonpTransportFactory(httpClient) {
  return wiredFor(httpClient).httpJsonpTransportFactory;
}

export function getBulkTransportFactory(httpClient) {
  return wiredFor(httpClient).bulkTransportFactory;
}

export function getHttpProxyTransportFactory(httpClient) {
  return wiredFor(httpClient).httpProxyTransportFactory;
}

export function getTransportSvc(httpClient) {
  return wiredFor(httpClient).transportSvc;
}

export function getSolrSearcherConstructor(httpClient) {
  return wiredFor(httpClient).solrSearcherConstructor;
}

export function getEsSearcherConstructor(httpClient) {
  return wiredFor(httpClient).esSearcherConstructor;
}

export function getVectaraSearcherConstructor(httpClient) {
  return wiredFor(httpClient).vectaraSearcherConstructor;
}

export function getAlgoliaSearcherConstructor(httpClient) {
  return wiredFor(httpClient).algoliaSearcherConstructor;
}

export function getSearchApiSearcherConstructor(httpClient) {
  return wiredFor(httpClient).searchApiSearcherConstructor;
}

export function getSearchSvc(httpClient) {
  return wiredFor(httpClient).searchSvc;
}

export function getSettingsValidatorFactory(httpClient) {
  return wiredFor(httpClient).settingsValidatorFactory;
}

export function getResolverFactory(httpClient) {
  return wiredFor(httpClient).resolverFactory;
}

export function getDocResolverSvc(httpClient) {
  return wiredFor(httpClient).docResolverSvc;
}

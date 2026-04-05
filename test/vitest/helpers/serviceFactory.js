/**
 * Manual dependency wiring for Vitest tests — replaces Angular DI.
 *
 * Each create* function instantiates a service/factory with its full
 * dependency chain, returning the same object Angular would inject.
 */
import URI from 'urijs';
// esUrlSvc uses URI as a global (loaded via script tag in Karma)
if (typeof globalThis.URI === 'undefined') {
  globalThis.URI = URI;
}

import { utilsSvcFactory } from '../../../services/utilsSvc.js';
import { tryParseObject } from '../../../services/customHeadersJson.js';
import { vectorSvcConstructor } from '../../../services/vectorSvc.js';
import { fieldSpecSvcConstructor } from '../../../services/fieldSpecSvc.js';
import { solrUrlSvcConstructor } from '../../../services/solrUrlSvc.js';
import { esUrlSvcConstructor } from '../../../services/esUrlSvc.js';
import { vectaraUrlSvcConstructor } from '../../../services/vectaraUrlSvc.js';
import { queryTemplateSvcConstructor } from '../../../services/queryTemplateSvc.js';
import { baseExplainSvcConstructor } from '../../../services/baseExplainSvc.js';
import { simExplainSvcConstructor } from '../../../services/simExplainSvc.js';
import { queryExplainSvcConstructor } from '../../../services/queryExplainSvc.js';
import { explainSvcConstructor } from '../../../services/explainSvc.js';
import { normalDocsSvcConstructor } from '../../../services/normalDocsSvc.js';
import { esExplainExtractorSvcConstructor } from '../../../services/esExplainExtractorSvc.js';
import { solrExplainExtractorSvcConstructor } from '../../../services/solrExplainExtractorSvc.js';
import { esSearcherPreprocessorSvcConstructor } from '../../../services/esSearcherPreprocessorSvc.js';
import { solrSearcherPreprocessorSvcConstructor } from '../../../services/solrSearcherPreprocessorSvc.js';
import { vectaraSearcherPreprocessorSvcConstructor } from '../../../services/vectaraSearcherPreprocessorSvc.js';
import { algoliaSearcherPreprocessorSvcConstructor } from '../../../services/algoliaSearcherPreprocessorSvc.js';
import { searchApiSearcherPreprocessorSvcConstructor } from '../../../services/searchApiSearcherPreprocessorSvc.js';

import { transportSvcConstructor } from '../../../services/transportSvc.js';
import { searchSvcConstructor } from '../../../services/searchSvc.js';
import { docResolverSvcConstructor } from '../../../services/docResolverSvc.js';

import { TransportFactory } from '../../../factories/transportFactory.js';
import { SearcherFactory } from '../../../factories/searcherFactory.js';
import { DocFactory } from '../../../factories/docFactory.js';
import { HttpGetTransportFactory } from '../../../factories/httpGetTransportFactory.js';
import { HttpPostTransportFactory } from '../../../factories/httpPostTransportFactory.js';
import { HttpJsonpTransportFactory } from '../../../factories/httpJsonpTransportFactory.js';
import { HttpProxyTransportFactory } from '../../../factories/httpProxyTransportFactory.js';
import { BulkTransportFactory } from '../../../factories/bulkTransportFactory.js';
import { SettingsValidatorFactory } from '../../../factories/settingsValidatorFactory.js';
import { ResolverFactory } from '../../../factories/resolverFactory.js';
import { SolrSearcherFactory } from '../../../factories/solrSearcherFactory.js';
import { EsSearcherFactory } from '../../../factories/esSearcherFactory.js';
import { VectaraSearcherFactory } from '../../../factories/vectaraSearcherFactory.js';
import { AlgoliaSearcherFactory } from '../../../factories/algoliaSearchFactory.js';
import { SearchApiSearcherFactory } from '../../../factories/searchApiSearcherFactory.js';

import { activeQueries } from '../../../values/activeQueries.js';
import { EsDocFactory } from '../../../factories/esDocFactory.js';
import { SolrDocFactory } from '../../../factories/solrDocFactory.js';
import { VectaraDocFactory } from '../../../factories/vectaraDocFactory.js';
import { AlgoliaDocFactory } from '../../../factories/algoliaDocFactory.js';
import { SearchApiDocFactory } from '../../../factories/searchApiDocFactory.js';

import { defaultSolrConfig } from '../../../values/defaultSolrConfig.js';
import { defaultESConfig } from '../../../values/defaultESConfig.js';
import { defaultVectaraConfig } from '../../../values/defaultVectaraConfig.js';

// Singleton-ish instances (stateless services can be shared)
var _utilsSvc;
export function getUtilsSvc() {
  if (!_utilsSvc) _utilsSvc = utilsSvcFactory();
  return _utilsSvc;
}

var _customHeadersJson;
export function getCustomHeadersJson() {
  if (!_customHeadersJson) _customHeadersJson = { tryParseObject: tryParseObject };
  return _customHeadersJson;
}

export function getVectorSvc() {
  return new vectorSvcConstructor(getUtilsSvc());
}

export function getFieldSpecSvc() {
  return new fieldSpecSvcConstructor(getUtilsSvc());
}

export function getSolrUrlSvc() {
  return new solrUrlSvcConstructor(getUtilsSvc());
}

export function getEsUrlSvc() {
  return new esUrlSvcConstructor(getCustomHeadersJson(), getUtilsSvc());
}

export function getVectaraUrlSvc() {
  return new vectaraUrlSvcConstructor(getCustomHeadersJson());
}

export function getQueryTemplateSvc() {
  return new queryTemplateSvcConstructor();
}

export function getBaseExplainSvc() {
  return new baseExplainSvcConstructor(getVectorSvc(), getUtilsSvc());
}

export function getSimExplainSvc() {
  return new simExplainSvcConstructor(getUtilsSvc());
}

export function getQueryExplainSvc() {
  return new queryExplainSvcConstructor(getBaseExplainSvc(), getVectorSvc(), getSimExplainSvc(), getUtilsSvc());
}

export function getExplainSvc() {
  return new explainSvcConstructor(getBaseExplainSvc(), getQueryExplainSvc(), getSimExplainSvc(), getUtilsSvc());
}

export function getNormalDocsSvc() {
  return new normalDocsSvcConstructor(getExplainSvc(), getUtilsSvc());
}

export function getEsExplainExtractorSvc() {
  return new esExplainExtractorSvcConstructor(getNormalDocsSvc(), getUtilsSvc());
}

export function getSolrExplainExtractorSvc() {
  return new solrExplainExtractorSvcConstructor(getNormalDocsSvc(), getUtilsSvc());
}

export function getEsSearcherPreprocessorSvc() {
  return new esSearcherPreprocessorSvcConstructor(getQueryTemplateSvc(), defaultESConfig, getUtilsSvc());
}

export function getSolrSearcherPreprocessorSvc(overrideDefaultConfig) {
  return new solrSearcherPreprocessorSvcConstructor(
    getSolrUrlSvc(),
    overrideDefaultConfig || defaultSolrConfig,
    getQueryTemplateSvc(),
    getUtilsSvc()
  );
}

export function getVectaraSearcherPreprocessorSvc() {
  return new vectaraSearcherPreprocessorSvcConstructor(getQueryTemplateSvc(), defaultVectaraConfig, getUtilsSvc());
}

export function getAlgoliaSearcherPreprocessorSvc() {
  return new algoliaSearcherPreprocessorSvcConstructor(getQueryTemplateSvc());
}

export function getSearchApiSearcherPreprocessorSvc() {
  return new searchApiSearcherPreprocessorSvcConstructor(getQueryTemplateSvc(), getUtilsSvc());
}

// Factory getters — these return constructor functions (not instances)
export function getDocConstructor() {
  return DocFactory(getUtilsSvc());
}

export function getEsDocConstructor() {
  return EsDocFactory(getEsUrlSvc(), getDocConstructor(), getUtilsSvc());
}

export function getSolrDocConstructor() {
  return SolrDocFactory(getDocConstructor(), getSolrUrlSvc(), getUtilsSvc());
}

export function getVectaraDocConstructor() {
  return VectaraDocFactory(getVectaraUrlSvc(), getDocConstructor(), getUtilsSvc());
}

export function getAlgoliaDocConstructor() {
  return AlgoliaDocFactory(getDocConstructor(), getUtilsSvc());
}

export function getSearchApiDocConstructor() {
  return SearchApiDocFactory(getDocConstructor(), getUtilsSvc());
}

export function getTransportConstructor() {
  return TransportFactory();
}

export function getSearcherConstructor() {
  return SearcherFactory();
}

// ── Transport factories (need httpClient injection) ──────────────────────
export function getHttpGetTransportFactory(httpClient) {
  return HttpGetTransportFactory(getTransportConstructor(), httpClient);
}

export function getHttpPostTransportFactory(httpClient) {
  return HttpPostTransportFactory(getTransportConstructor(), httpClient);
}

export function getHttpJsonpTransportFactory(httpClient, $sce) {
  return HttpJsonpTransportFactory(getTransportConstructor(), httpClient, $sce || null);
}

export function getBulkTransportFactory(httpClient) {
  return BulkTransportFactory(getTransportConstructor(), httpClient, getUtilsSvc());
}

export function getHttpProxyTransportFactory(httpClient, $sce) {
  var BaseTransport = getTransportConstructor();
  var JsonpFactory = HttpJsonpTransportFactory(BaseTransport, httpClient, $sce || null);
  return HttpProxyTransportFactory(BaseTransport, JsonpFactory);
}

export function getTransportSvc(httpClient, $sce) {
  var BaseTransport = getTransportConstructor();
  var PostFactory = HttpPostTransportFactory(BaseTransport, httpClient);
  var GetFactory = HttpGetTransportFactory(BaseTransport, httpClient);
  var JsonpFactory = HttpJsonpTransportFactory(BaseTransport, httpClient, $sce || null);
  var BulkFactory = BulkTransportFactory(BaseTransport, httpClient, getUtilsSvc());
  var ProxyFactory = HttpProxyTransportFactory(BaseTransport, JsonpFactory);
  return new transportSvcConstructor(PostFactory, GetFactory, JsonpFactory, BulkFactory, ProxyFactory);
}

// ── Searcher factory constructors (match Angular DI registration order) ──
export function getSolrSearcherConstructor(httpClient, $sce) {
  // SolrSearcherFactory(SolrDocFactory, SearcherFactory, transportSvc, activeQueries,
  //                     defaultSolrConfig, solrSearcherPreprocessorSvc, esUrlSvc, utilsSvc)
  return SolrSearcherFactory(
    getSolrDocConstructor(), getSearcherConstructor(),
    getTransportSvc(httpClient, $sce), activeQueries,
    defaultSolrConfig, getSolrSearcherPreprocessorSvc(),
    getEsUrlSvc(), getUtilsSvc()
  );
}

export function getEsSearcherConstructor(httpClient, $sce) {
  // EsSearcherFactory(httpClient, EsDocFactory, activeQueries,
  //                   esSearcherPreprocessorSvc, esUrlSvc, SearcherFactory,
  //                   transportSvc, utilsSvc)
  return EsSearcherFactory(
    httpClient, getEsDocConstructor(), activeQueries,
    getEsSearcherPreprocessorSvc(), getEsUrlSvc(),
    getSearcherConstructor(), getTransportSvc(httpClient, $sce),
    getUtilsSvc()
  );
}

export function getVectaraSearcherConstructor(httpClient, $sce) {
  // VectaraSearcherFactory(VectaraDocFactory, activeQueries,
  //                        vectaraSearcherPreprocessorSvc, vectaraUrlSvc,
  //                        SearcherFactory, transportSvc, utilsSvc)
  return VectaraSearcherFactory(
    getVectaraDocConstructor(), activeQueries,
    getVectaraSearcherPreprocessorSvc(), getVectaraUrlSvc(),
    getSearcherConstructor(), getTransportSvc(httpClient, $sce),
    getUtilsSvc()
  );
}

export function getAlgoliaSearcherConstructor(httpClient, $sce) {
  // AlgoliaSearcherFactory(AlgoliaDocFactory, activeQueries,
  //                        algoliaSearcherPreprocessorSvc, esUrlSvc,
  //                        SearcherFactory, transportSvc, utilsSvc)
  return AlgoliaSearcherFactory(
    getAlgoliaDocConstructor(), activeQueries,
    getAlgoliaSearcherPreprocessorSvc(), getEsUrlSvc(),
    getSearcherConstructor(), getTransportSvc(httpClient, $sce),
    getUtilsSvc()
  );
}

export function getSearchApiSearcherConstructor(httpClient, $sce) {
  // SearchApiSearcherFactory(SearchApiDocFactory, activeQueries,
  //                          searchApiSearcherPreprocessorSvc, esUrlSvc,
  //                          SearcherFactory, transportSvc, utilsSvc)
  return SearchApiSearcherFactory(
    getSearchApiDocConstructor(), activeQueries,
    getSearchApiSearcherPreprocessorSvc(), getEsUrlSvc(),
    getSearcherConstructor(), getTransportSvc(httpClient, $sce),
    getUtilsSvc()
  );
}

// ── searchSvc (needs searcher factories) ──────────
export function getSearchSvc(httpClient, $sce) {
  // searchSvcConstructor(SolrSearcherFactory, EsSearcherFactory,
  //                      VectaraSearcherFactory, AlgoliaSearcherFactory,
  //                      SearchApiSearcherFactory, activeQueries,
  //                      defaultSolrConfig, customHeadersJson, utilsSvc)
  return new searchSvcConstructor(
    getSolrSearcherConstructor(httpClient, $sce),
    getEsSearcherConstructor(httpClient, $sce),
    getVectaraSearcherConstructor(httpClient, $sce),
    getAlgoliaSearcherConstructor(httpClient, $sce),
    getSearchApiSearcherConstructor(httpClient, $sce),
    activeQueries,
    defaultSolrConfig,
    getCustomHeadersJson(),
    getUtilsSvc()
  );
}

export function getSettingsValidatorFactory(httpClient, $sce) {
  return SettingsValidatorFactory(
    getFieldSpecSvc(),
    getSearchSvc(httpClient, $sce),
    getUtilsSvc()
  );
}

export function getResolverFactory(httpClient, $sce) {
  return ResolverFactory(
    getSearchSvc(httpClient, $sce),
    getSolrUrlSvc(),
    getNormalDocsSvc(),
    getUtilsSvc()
  );
}

export function getDocResolverSvc(httpClient, $sce) {
  return new docResolverSvcConstructor(getResolverFactory(httpClient, $sce));
}

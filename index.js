/**
 * splainer-search — ESM entry point.
 *
 * Re-exports every public constructor, factory, and value so consumers
 * can import individually or use the bundled IIFE (`dist/splainer-search.js` after `npm run build`).
 */

// ── Services ────────────────────────────────────────────────────────────
export { utilsSvcFactory } from './services/utilsSvc.js';
export { tryParseObject } from './services/customHeadersJson.js';
export { createFetchClient } from './services/httpClient.js';
export { isAbortError, transportRequestOpts } from './services/transportRequestOpts.js';
export { vectorSvcConstructor } from './services/vectorSvc.js';
export { fieldSpecSvcConstructor } from './services/fieldSpecSvc.js';
export { solrUrlSvcConstructor } from './services/solrUrlSvc.js';
export { esUrlSvcConstructor } from './services/esUrlSvc.js';
export { vectaraUrlSvcConstructor } from './services/vectaraUrlSvc.js';
export { queryTemplateSvcConstructor } from './services/queryTemplateSvc.js';
export { baseExplainSvcConstructor } from './services/baseExplainSvc.js';
export { simExplainSvcConstructor } from './services/simExplainSvc.js';
export { queryExplainSvcConstructor } from './services/queryExplainSvc.js';
export { explainSvcConstructor } from './services/explainSvc.js';
export { normalDocsSvcConstructor } from './services/normalDocsSvc.js';
export { esExplainExtractorSvcConstructor } from './services/esExplainExtractorSvc.js';
export { solrExplainExtractorSvcConstructor } from './services/solrExplainExtractorSvc.js';
export { esSearcherPreprocessorSvcConstructor } from './services/esSearcherPreprocessorSvc.js';
export { solrSearcherPreprocessorSvcConstructor } from './services/solrSearcherPreprocessorSvc.js';
export { vectaraSearcherPreprocessorSvcConstructor } from './services/vectaraSearcherPreprocessorSvc.js';
export { algoliaSearcherPreprocessorSvcConstructor } from './services/algoliaSearcherPreprocessorSvc.js';
export { searchApiSearcherPreprocessorSvcConstructor } from './services/searchApiSearcherPreprocessorSvc.js';
export { transportSvcConstructor } from './services/transportSvc.js';
export { searchSvcConstructor } from './services/searchSvc.js';
export { docResolverSvcConstructor } from './services/docResolverSvc.js';

// ── Factories ───────────────────────────────────────────────────────────
export { TransportFactory } from './factories/transportFactory.js';
export { SearcherFactory } from './factories/searcherFactory.js';
export { DocFactory } from './factories/docFactory.js';
export { HttpGetTransportFactory } from './factories/httpGetTransportFactory.js';
export { HttpPostTransportFactory } from './factories/httpPostTransportFactory.js';
export { HttpJsonpTransportFactory } from './factories/httpJsonpTransportFactory.js';
export { HttpProxyTransportFactory } from './factories/httpProxyTransportFactory.js';
export { BulkTransportFactory } from './factories/bulkTransportFactory.js';
export { SettingsValidatorFactory } from './factories/settingsValidatorFactory.js';
export { ResolverFactory } from './factories/resolverFactory.js';
export { SolrSearcherFactory } from './factories/solrSearcherFactory.js';
export { EsSearcherFactory } from './factories/esSearcherFactory.js';
export { VectaraSearcherFactory } from './factories/vectaraSearcherFactory.js';
export { AlgoliaSearcherFactory } from './factories/algoliaSearchFactory.js';
export { SearchApiSearcherFactory } from './factories/searchApiSearcherFactory.js';
export { EsDocFactory } from './factories/esDocFactory.js';
export { SolrDocFactory } from './factories/solrDocFactory.js';
export { VectaraDocFactory } from './factories/vectaraDocFactory.js';
export { AlgoliaDocFactory } from './factories/algoliaDocFactory.js';
export { SearchApiDocFactory } from './factories/searchApiDocFactory.js';

// ── Values ──────────────────────────────────────────────────────────────
export { activeQueries } from './values/activeQueries.js';
export { defaultESConfig } from './values/defaultESConfig.js';
export { defaultSolrConfig } from './values/defaultSolrConfig.js';
export { defaultVectaraConfig } from './values/defaultVectaraConfig.js';

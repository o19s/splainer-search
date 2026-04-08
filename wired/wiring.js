/**
 * Canonical dependency graph for Splainer / Quepid–style consumers.
 *
 * Same wiring as Vitest’s serviceFactory (and the public `splainer-search/wired.js`
 * entry): one call builds a consistent graph for a given HTTP client.
 *
 * @param {object} httpClient - Return value of `createFetchClient()` from `services/httpClient.js` (or compatible).
 * @returns {object} Wired service instances, factories, and create* helpers (see `wired.js` docs).
 */
'use strict';

import { utilsSvcFactory } from '../services/utilsSvc.js';
import { tryParseObject } from '../services/customHeadersJson.js';
import { vectorSvcConstructor } from '../services/vectorSvc.js';
import { fieldSpecSvcConstructor } from '../services/fieldSpecSvc.js';
import { solrUrlSvcConstructor } from '../services/solrUrlSvc.js';
import { esUrlSvcConstructor } from '../services/esUrlSvc.js';
import { vectaraUrlSvcConstructor } from '../services/vectaraUrlSvc.js';
import { queryTemplateSvcConstructor } from '../services/queryTemplateSvc.js';
import { baseExplainSvcConstructor } from '../services/baseExplainSvc.js';
import { simExplainSvcConstructor } from '../services/simExplainSvc.js';
import { queryExplainSvcConstructor } from '../services/queryExplainSvc.js';
import { explainSvcConstructor } from '../services/explainSvc.js';
import { normalDocsSvcConstructor } from '../services/normalDocsSvc.js';
import { esExplainExtractorSvcConstructor } from '../services/esExplainExtractorSvc.js';
import { solrExplainExtractorSvcConstructor } from '../services/solrExplainExtractorSvc.js';
import { esSearcherPreprocessorSvcConstructor } from '../services/esSearcherPreprocessorSvc.js';
import { solrSearcherPreprocessorSvcConstructor } from '../services/solrSearcherPreprocessorSvc.js';
import { vectaraSearcherPreprocessorSvcConstructor } from '../services/vectaraSearcherPreprocessorSvc.js';
import { algoliaSearcherPreprocessorSvcConstructor } from '../services/algoliaSearcherPreprocessorSvc.js';
import { searchApiSearcherPreprocessorSvcConstructor } from '../services/searchApiSearcherPreprocessorSvc.js';

import { transportSvcConstructor } from '../services/transportSvc.js';
import { searchSvcConstructor } from '../services/searchSvc.js';
import { docResolverSvcConstructor } from '../services/docResolverSvc.js';

import { TransportFactory } from '../factories/transportFactory.js';
import { SearcherFactory } from '../factories/searcherFactory.js';
import { DocFactory } from '../factories/docFactory.js';
import { HttpGetTransportFactory } from '../factories/httpGetTransportFactory.js';
import { HttpPostTransportFactory } from '../factories/httpPostTransportFactory.js';
import { HttpJsonpTransportFactory } from '../factories/httpJsonpTransportFactory.js';
import { HttpProxyTransportFactory } from '../factories/httpProxyTransportFactory.js';
import { BulkTransportFactory } from '../factories/bulkTransportFactory.js';
import { SettingsValidatorFactory } from '../factories/settingsValidatorFactory.js';
import { ResolverFactory } from '../factories/resolverFactory.js';
import { SolrSearcherFactory } from '../factories/solrSearcherFactory.js';
import { EsSearcherFactory } from '../factories/esSearcherFactory.js';
import { VectaraSearcherFactory } from '../factories/vectaraSearcherFactory.js';
import { AlgoliaSearcherFactory } from '../factories/algoliaSearchFactory.js';
import { SearchApiSearcherFactory } from '../factories/searchApiSearcherFactory.js';

import { activeQueries } from '../values/activeQueries.js';
import { EsDocFactory } from '../factories/esDocFactory.js';
import { SolrDocFactory } from '../factories/solrDocFactory.js';
import { VectaraDocFactory } from '../factories/vectaraDocFactory.js';
import { AlgoliaDocFactory } from '../factories/algoliaDocFactory.js';
import { SearchApiDocFactory } from '../factories/searchApiDocFactory.js';

import { defaultSolrConfig } from '../values/defaultSolrConfig.js';
import { defaultESConfig } from '../values/defaultESConfig.js';
import { defaultVectaraConfig } from '../values/defaultVectaraConfig.js';

export function createWiredServices(httpClient) {
  var _utilsSvc;
  function utilsSvc() {
    if (!_utilsSvc) _utilsSvc = utilsSvcFactory();
    return _utilsSvc;
  }

  var _customHeadersJson;
  function customHeadersJson() {
    if (!_customHeadersJson) _customHeadersJson = { tryParseObject: tryParseObject };
    return _customHeadersJson;
  }

  function vectorSvc() {
    return new vectorSvcConstructor(utilsSvc());
  }

  function fieldSpecSvc() {
    return new fieldSpecSvcConstructor(utilsSvc());
  }

  function solrUrlSvc() {
    return new solrUrlSvcConstructor(utilsSvc());
  }

  function esUrlSvc() {
    return new esUrlSvcConstructor(customHeadersJson(), utilsSvc());
  }

  function vectaraUrlSvc() {
    return new vectaraUrlSvcConstructor(customHeadersJson());
  }

  function queryTemplateSvc() {
    return new queryTemplateSvcConstructor();
  }

  function baseExplainSvc() {
    return new baseExplainSvcConstructor(vectorSvc(), utilsSvc());
  }

  function simExplainSvc() {
    return new simExplainSvcConstructor(utilsSvc());
  }

  function queryExplainSvc() {
    return new queryExplainSvcConstructor(
      baseExplainSvc(),
      vectorSvc(),
      simExplainSvc(),
      utilsSvc(),
    );
  }

  function explainSvc() {
    return new explainSvcConstructor(
      baseExplainSvc(),
      queryExplainSvc(),
      simExplainSvc(),
      utilsSvc(),
    );
  }

  function normalDocsSvc() {
    return new normalDocsSvcConstructor(explainSvc(), utilsSvc());
  }

  function esExplainExtractorSvc() {
    return new esExplainExtractorSvcConstructor(normalDocsSvc(), utilsSvc());
  }

  function solrExplainExtractorSvc() {
    return new solrExplainExtractorSvcConstructor(normalDocsSvc(), utilsSvc());
  }

  function esSearcherPreprocessorSvc() {
    return new esSearcherPreprocessorSvcConstructor(
      queryTemplateSvc(),
      defaultESConfig,
      utilsSvc(),
    );
  }

  function solrSearcherPreprocessorSvc() {
    return new solrSearcherPreprocessorSvcConstructor(
      solrUrlSvc(),
      defaultSolrConfig,
      queryTemplateSvc(),
      utilsSvc(),
    );
  }

  function vectaraSearcherPreprocessorSvc() {
    return new vectaraSearcherPreprocessorSvcConstructor(
      queryTemplateSvc(),
      defaultVectaraConfig,
      utilsSvc(),
    );
  }

  function algoliaSearcherPreprocessorSvc() {
    return new algoliaSearcherPreprocessorSvcConstructor(queryTemplateSvc());
  }

  function searchApiSearcherPreprocessorSvc() {
    return new searchApiSearcherPreprocessorSvcConstructor(queryTemplateSvc(), utilsSvc());
  }

  var transportConstructor = TransportFactory();
  var searcherConstructor = SearcherFactory();
  var docConstructor = DocFactory(utilsSvc());
  var esDocConstructor = EsDocFactory(esUrlSvc(), docConstructor, utilsSvc());
  var solrDocConstructor = SolrDocFactory(docConstructor, solrUrlSvc(), utilsSvc());
  var vectaraDocConstructor = VectaraDocFactory(vectaraUrlSvc(), docConstructor, utilsSvc());
  var algoliaDocConstructor = AlgoliaDocFactory(docConstructor, utilsSvc());
  var searchApiDocConstructor = SearchApiDocFactory(docConstructor, utilsSvc());

  var postFactory = HttpPostTransportFactory(transportConstructor, httpClient);
  var getFactory = HttpGetTransportFactory(transportConstructor, httpClient);
  var jsonpFactory = HttpJsonpTransportFactory(transportConstructor, httpClient);
  var bulkFactory = BulkTransportFactory(transportConstructor, httpClient, utilsSvc());
  var proxyFactory = HttpProxyTransportFactory(transportConstructor, jsonpFactory);

  var transportSvc = new transportSvcConstructor(
    postFactory,
    getFactory,
    jsonpFactory,
    bulkFactory,
    proxyFactory,
  );

  var solrSearcherConstructor = SolrSearcherFactory(
    solrDocConstructor,
    searcherConstructor,
    transportSvc,
    activeQueries,
    defaultSolrConfig,
    solrSearcherPreprocessorSvc(),
    esUrlSvc(),
    utilsSvc(),
  );

  var esSearcherConstructor = EsSearcherFactory(
    httpClient,
    esDocConstructor,
    activeQueries,
    esSearcherPreprocessorSvc(),
    esUrlSvc(),
    searcherConstructor,
    transportSvc,
    utilsSvc(),
  );

  var vectaraSearcherConstructor = VectaraSearcherFactory(
    vectaraDocConstructor,
    activeQueries,
    vectaraSearcherPreprocessorSvc(),
    vectaraUrlSvc(),
    searcherConstructor,
    transportSvc,
    utilsSvc(),
  );

  var algoliaSearcherConstructor = AlgoliaSearcherFactory(
    algoliaDocConstructor,
    activeQueries,
    algoliaSearcherPreprocessorSvc(),
    esUrlSvc(),
    searcherConstructor,
    transportSvc,
    utilsSvc(),
  );

  var searchApiSearcherConstructor = SearchApiSearcherFactory(
    searchApiDocConstructor,
    activeQueries,
    searchApiSearcherPreprocessorSvc(),
    esUrlSvc(),
    searcherConstructor,
    transportSvc,
    utilsSvc(),
  );

  var searchSvc = new searchSvcConstructor(
    solrSearcherConstructor,
    esSearcherConstructor,
    vectaraSearcherConstructor,
    algoliaSearcherConstructor,
    searchApiSearcherConstructor,
    activeQueries,
    defaultSolrConfig,
    customHeadersJson(),
    utilsSvc(),
  );

  var settingsValidatorFactory = SettingsValidatorFactory(fieldSpecSvc(), searchSvc, utilsSvc());

  var resolverFactory = ResolverFactory(searchSvc, solrUrlSvc(), normalDocsSvc(), utilsSvc());

  var docResolverSvc = new docResolverSvcConstructor(resolverFactory);

  var utilsSvcInst = utilsSvc();
  var customHeadersJsonInst = customHeadersJson();
  var vectorSvcInst = vectorSvc();
  var fieldSpecSvcInst = fieldSpecSvc();
  var solrUrlSvcInst = solrUrlSvc();
  var esUrlSvcInst = esUrlSvc();
  var vectaraUrlSvcInst = vectaraUrlSvc();
  var queryTemplateSvcInst = queryTemplateSvc();
  var baseExplainSvcInst = baseExplainSvc();
  var simExplainSvcInst = simExplainSvc();
  var queryExplainSvcInst = queryExplainSvc();
  var explainSvcInst = explainSvc();
  var normalDocsSvcInst = normalDocsSvc();
  var esExplainExtractorSvcInst = esExplainExtractorSvc();
  var solrExplainExtractorSvcInst = solrExplainExtractorSvc();
  var esSearcherPreprocessorSvcInst = esSearcherPreprocessorSvc();
  var solrSearcherPreprocessorSvcInst = solrSearcherPreprocessorSvc();
  var vectaraSearcherPreprocessorSvcInst = vectaraSearcherPreprocessorSvc();
  var algoliaSearcherPreprocessorSvcInst = algoliaSearcherPreprocessorSvc();
  var searchApiSearcherPreprocessorSvcInst = searchApiSearcherPreprocessorSvc();

  return {
    utilsSvc: utilsSvcInst,
    customHeadersJson: customHeadersJsonInst,
    vectorSvc: vectorSvcInst,
    fieldSpecSvc: fieldSpecSvcInst,
    solrUrlSvc: solrUrlSvcInst,
    esUrlSvc: esUrlSvcInst,
    vectaraUrlSvc: vectaraUrlSvcInst,
    queryTemplateSvc: queryTemplateSvcInst,
    baseExplainSvc: baseExplainSvcInst,
    simExplainSvc: simExplainSvcInst,
    queryExplainSvc: queryExplainSvcInst,
    explainSvc: explainSvcInst,
    normalDocsSvc: normalDocsSvcInst,
    esExplainExtractorSvc: esExplainExtractorSvcInst,
    solrExplainExtractorSvc: solrExplainExtractorSvcInst,
    esSearcherPreprocessorSvc: esSearcherPreprocessorSvcInst,
    solrSearcherPreprocessorSvc: solrSearcherPreprocessorSvcInst,
    vectaraSearcherPreprocessorSvc: vectaraSearcherPreprocessorSvcInst,
    algoliaSearcherPreprocessorSvc: algoliaSearcherPreprocessorSvcInst,
    searchApiSearcherPreprocessorSvc: searchApiSearcherPreprocessorSvcInst,
    transportSvc: transportSvc,
    searchSvc: searchSvc,
    settingsValidatorFactory: settingsValidatorFactory,
    resolverFactory: resolverFactory,
    docResolverSvc: docResolverSvc,
    transportConstructor: transportConstructor,
    searcherConstructor: searcherConstructor,
    docConstructor: docConstructor,
    esDocConstructor: esDocConstructor,
    solrDocConstructor: solrDocConstructor,
    vectaraDocConstructor: vectaraDocConstructor,
    algoliaDocConstructor: algoliaDocConstructor,
    searchApiDocConstructor: searchApiDocConstructor,
    solrSearcherConstructor: solrSearcherConstructor,
    esSearcherConstructor: esSearcherConstructor,
    vectaraSearcherConstructor: vectaraSearcherConstructor,
    algoliaSearcherConstructor: algoliaSearcherConstructor,
    searchApiSearcherConstructor: searchApiSearcherConstructor,
    httpGetTransportFactory: HttpGetTransportFactory(transportConstructor, httpClient),
    httpPostTransportFactory: HttpPostTransportFactory(transportConstructor, httpClient),
    httpJsonpTransportFactory: HttpJsonpTransportFactory(transportConstructor, httpClient),
    bulkTransportFactory: BulkTransportFactory(transportConstructor, httpClient, utilsSvcInst),
    httpProxyTransportFactory: proxyFactory,
    activeQueries: activeQueries,
    defaultSolrConfig: defaultSolrConfig,
    defaultESConfig: defaultESConfig,
    defaultVectaraConfig: defaultVectaraConfig,

    createSolrSearcherPreprocessorSvc: function (overrideDefaultConfig) {
      return new solrSearcherPreprocessorSvcConstructor(
        solrUrlSvcInst,
        overrideDefaultConfig || defaultSolrConfig,
        queryTemplateSvcInst,
        utilsSvcInst,
      );
    },

    createSearcher: function () {
      return searchSvc.createSearcher.apply(searchSvc, arguments);
    },
    createFieldSpec: function () {
      return fieldSpecSvcInst.createFieldSpec.apply(fieldSpecSvcInst, arguments);
    },
    createNormalDoc: function () {
      return normalDocsSvcInst.createNormalDoc.apply(normalDocsSvcInst, arguments);
    },
  };
}

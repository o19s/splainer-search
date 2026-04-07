/**
 * Smoke tests for package entry points: ensures re-exports stay wired after refactors.
 * Matches the style of other Vitest files (describe / it / expect, node env).
 */
import { describe, it, expect } from 'vitest';
import * as root from '../../index.js';
import * as wired from '../../wired.js';

/** @type {string[]} — keep in sync with index.js named exports */
var ROOT_EXPORT_NAMES = [
  'utilsSvcFactory',
  'tryParseObject',
  'createFetchClient',
  'isAbortError',
  'transportRequestOpts',
  'vectorSvcConstructor',
  'fieldSpecSvcConstructor',
  'solrUrlSvcConstructor',
  'esUrlSvcConstructor',
  'vectaraUrlSvcConstructor',
  'queryTemplateSvcConstructor',
  'baseExplainSvcConstructor',
  'simExplainSvcConstructor',
  'queryExplainSvcConstructor',
  'explainSvcConstructor',
  'normalDocsSvcConstructor',
  'esExplainExtractorSvcConstructor',
  'solrExplainExtractorSvcConstructor',
  'esSearcherPreprocessorSvcConstructor',
  'solrSearcherPreprocessorSvcConstructor',
  'vectaraSearcherPreprocessorSvcConstructor',
  'algoliaSearcherPreprocessorSvcConstructor',
  'searchApiSearcherPreprocessorSvcConstructor',
  'transportSvcConstructor',
  'searchSvcConstructor',
  'docResolverSvcConstructor',
  'TransportFactory',
  'SearcherFactory',
  'DocFactory',
  'HttpGetTransportFactory',
  'HttpPostTransportFactory',
  'HttpJsonpTransportFactory',
  'HttpProxyTransportFactory',
  'BulkTransportFactory',
  'SettingsValidatorFactory',
  'ResolverFactory',
  'SolrSearcherFactory',
  'EsSearcherFactory',
  'VectaraSearcherFactory',
  'AlgoliaSearcherFactory',
  'SearchApiSearcherFactory',
  'EsDocFactory',
  'SolrDocFactory',
  'VectaraDocFactory',
  'AlgoliaDocFactory',
  'SearchApiDocFactory',
  'activeQueries',
  'defaultESConfig',
  'defaultSolrConfig',
  'defaultVectaraConfig',
];

var ROOT_OBJECT_EXPORTS = new Set([
  'activeQueries',
  'defaultESConfig',
  'defaultSolrConfig',
  'defaultVectaraConfig',
]);

describe('index.js (package root)', function () {
  it('exports the expected named symbols', function () {
    var keys = Object.keys(root).sort();
    expect(keys).toEqual(ROOT_EXPORT_NAMES.slice().sort());
  });

  it('exports constructors and helpers as functions, configs as objects', function () {
    ROOT_EXPORT_NAMES.forEach(function (name) {
      var exp = root[name];
      expect(exp, name + ' is defined').toBeDefined();
      if (ROOT_OBJECT_EXPORTS.has(name)) {
        expect(typeof exp, name).toBe('object');
        expect(exp, name).not.toBeNull();
      } else {
        expect(typeof exp, name).toBe('function');
      }
    });
  });
});

describe('wired.js', function () {
  it('exports documented entry symbols', function () {
    expect(typeof wired.createWiredServices).toBe('function');
    expect(typeof wired.createFetchClient).toBe('function');
    expect(typeof wired.isAbortError).toBe('function');
    expect(typeof wired.transportRequestOpts).toBe('function');
    expect(typeof wired.activeQueries).toBe('object');
    expect(typeof wired.defaultSolrConfig).toBe('object');
    expect(typeof wired.defaultESConfig).toBe('object');
    expect(typeof wired.defaultVectaraConfig).toBe('object');
    expect(typeof wired.getDefaultWiredServices).toBe('function');
    expect(typeof wired.createWiredServicesWithFetch).toBe('function');
    expect(typeof wired.createSearcher).toBe('function');
    expect(typeof wired.createFieldSpec).toBe('function');
    expect(typeof wired.createNormalDoc).toBe('function');
    expect(typeof wired.wired).toBe('object');
  });

  it('lazy wired.* accessors resolve to services', function () {
    expect(typeof wired.wired.fieldSpecSvc).toBe('object');
    expect(typeof wired.wired.searchSvc).toBe('object');
  });
});

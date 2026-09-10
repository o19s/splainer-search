'use strict';

// Resolves a set of ids to Normal docs, using each engine's own Searcher#fetchDocs
// (see searcherFactory.js / <engine>SearcherFactory.js).
export function docResolverSvcConstructor(searchSvc, utilsSvc) {
  this.createResolver = function (ids, settings, chunkSize) {
    var fieldSpec = settings.createFieldSpec();

    var config = {
      sanitize: false,
      highlight: false,
      debug: false,
      escapeQuery: false,
      numberOfRows: ids.length,
    };

    // Only set optional config values when they are defined in settings, so that undefined
    // values do not clobber defaults when the config is merged.
    var optionalKeys = [
      'version',
      'proxyUrl',
      'customHeaders',
      'basicAuthCredential',
      'apiMethod',
      'signal',
    ];
    utilsSvc.safeForEach(optionalKeys, function (key) {
      if (settings[key] !== undefined) {
        config[key] = settings[key];
      }
    });

    var searcher = searchSvc.createSearcher(
      fieldSpec,
      settings.searchUrl,
      {},
      null,
      config,
      settings.searchEngine,
    );

    // Kept shaped like a Resolver instance (docs mutated in place, fetchDocs() also returning
    // the docs) for compatibility with existing callers (e.g. Quepid's docCacheSvc.js), which
    // read `resolver.docs` off this same object after fetchDocs() resolves.
    var resolver = { docs: [] };
    resolver.fetchDocs = function () {
      return searcher.fetchDocs(ids, fieldSpec, chunkSize).then(function (docs) {
        resolver.docs = docs;
        return docs;
      });
    };

    return resolver;
  };
}

'use strict';

// Resolves a set of ids to Normal docs
angular.module('o19s.splainer-search')
  .service('docResolverSvc', [
    '$log',
    'searchSvc',
    function docResolverSvc($log, searchSvc) {
      this.createResolver = function(ids, settings, chunkSize) {
        var fieldSpec = settings.createFieldSpec();

        var config = {
          sanitize:            false,
          highlight:           false,
          debug:               false,
          escapeQuery:         false,
          numberOfRows:        ids.length,
          version:             settings.version,
          proxyUrl:            settings.proxyUrl,
          customHeaders:       settings.customHeaders,
          basicAuthCredential: settings.basicAuthCredential,
          apiMethod:           settings.apiMethod
        };

        // Note: some engines (e.g. Vectara, SearchAPI) return empty args from buildResolverArgs
        // because they do not support direct document retrieval by ID. In those cases
        // fetchDocs will return placeholder stubs for all requested IDs.
        var resolverArgs = searchSvc.buildResolverArgs(ids, fieldSpec, settings.searchEngine);

        var searcher = searchSvc.createSearcher(
          fieldSpec,
          settings.searchUrl,
          resolverArgs.args,
          resolverArgs.queryText,
          config,
          settings.searchEngine
        );

        var resolver = {
          ids:       ids,
          docs:      [],
          fieldSpec: fieldSpec,
          searcher:  searcher,
          fetchDocs: function() {
            return searcher.fetchDocs(ids, fieldSpec, chunkSize)
              .then(function(docs) {
                resolver.docs = docs;
                return docs;
              })
              .catch(function(response) {
                $log.debug('Failed to fetch docs');
                return response;
              });
          }
        };

        return resolver;
      };
    }
  ]);

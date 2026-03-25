'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('ResolverFactory', [
      '$log',
      'searchSvc',
      ResolverFactory
    ]);

  function ResolverFactory($log, searchSvc) {
    var Resolver = function(ids, settings, chunkSize) {
      var self        = this;

      self.settings   = settings;
      self.ids        = ids;
      self.docs       = [];
      self.args       = {};
      self.config     = {};
      self.queryText  = null;
      self.fieldSpec  = self.settings.createFieldSpec();
      self.chunkSize  = chunkSize;

      self.fetchDocs  = fetchDocs;

      var resolverArgs = searchSvc.buildResolverArgs(ids, self.fieldSpec, self.settings.searchEngine);
      self.args      = resolverArgs.args;
      self.queryText = resolverArgs.queryText;
      // Note: some engines (e.g. Vectara, SearchAPI) return empty args because they do not support
      // direct document retrieval by ID. In those cases fetchDocs will return empty results.

      self.config = {
        sanitize:            false,
        highlight:           false,
        debug:               false,
        escapeQuery:         false,
        numberOfRows:        ids.length,
        version:             self.settings.version,
        proxyUrl:            self.settings.proxyUrl,
        customHeaders:       self.settings.customHeaders,
        basicAuthCredential: self.settings.basicAuthCredential,
        apiMethod:           self.settings.apiMethod
      };

      self.searcher = searchSvc.createSearcher(
        self.fieldSpec,
        self.settings.searchUrl,
        self.args,
        self.queryText,
        self.config,
        self.settings.searchEngine
      );

      function fetchDocs () {
        return self.searcher.fetchDocs(ids, self.fieldSpec, chunkSize)
          .then(function(docs) {
            self.docs = docs;
            return docs;
          })
          .catch(function(response) {
            $log.debug('Failed to fetch docs');
            return response;
          });
      }
    };

    // Return factory object
    return Resolver;
  }
})();

'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('SearcherFactory', [
      '$q',
      'normalDocsSvc',
      SearcherFactory
    ]);

  function SearcherFactory($q, normalDocsSvc) {
    var Searcher = function(options, preprocessor) {
      var self                = this;

      // Methods that we expect all engines to provide
      self.fieldList          = options.fieldList;
      self.hlFieldList        = options.hlFieldList;
      self.url                = options.url;
      self.args               = options.args;
      self.queryText          = options.queryText;
      self.config             = options.config;
      self.type               = options.type;
      self.customHeaders      = options.customHeaders;

      self.docs               = [];
      self.grouped            = {};
      self.numFound           = 0;
      self.inError            = false;
      self.othersExplained    = {};
      self.parsedQueryDetails = {};

      self.HIGHLIGHTING_PRE   = options.HIGHLIGHTING_PRE;
      self.HIGHLIGHTING_POST  = options.HIGHLIGHTING_POST;

      preprocessor.prepare(self);
    };

    // Fetches documents by their IDs using the engine-specific resolver query,
    // normalizing results and creating placeholder stubs for any missing documents.
    //
    // @param {Array}  ids       - List of document IDs to fetch
    // @param {Object} fieldSpec - Field specification used to build the query and normalize docs
    // @param {number} [chunkSize] - If provided, splits the fetch into parallel chunks of this size
    // @returns {Promise<Array>} Resolves to an array of normalized (and placeholder) documents
    Searcher.prototype.fetchDocs = function(ids, fieldSpec, chunkSize) {
      /*jslint validthis:true*/
      var self = this;
      var EngineSearcher = self.constructor;

      if (chunkSize === undefined) {
        var resolverArgs = EngineSearcher.buildResolverArgs(ids, fieldSpec);

        var resolverSearcher = new EngineSearcher({
          fieldList:         fieldSpec.fieldList(),
          hlFieldList:       fieldSpec.highlightFieldList(),
          url:               self.url,
          args:              resolverArgs.args,
          queryText:         resolverArgs.queryText,
          config:            self.config,
          type:              self.type,
          HIGHLIGHTING_PRE:  self.HIGHLIGHTING_PRE,
          HIGHLIGHTING_POST: self.HIGHLIGHTING_POST,
        });

        return resolverSearcher.search().then(function() {
          var docs = [];
          var idsToDocs = {};

          angular.forEach(resolverSearcher.docs, function(doc) {
            var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
            idsToDocs[normalDoc.id] = normalDoc;
          });

          angular.forEach(ids, function(docId) {
            if (idsToDocs.hasOwnProperty(docId)) {
              docs.push(idsToDocs[docId]);
            } else {
              docs.push(normalDocsSvc.createPlaceholderDoc(docId, 'Missing Doc: ' + docId));
            }
          });

          return docs;
        });
      } else {
        var slices = [];
        for (var i = 0; i < ids.length; i += chunkSize) {
          slices.push(ids.slice(i, i + chunkSize));
        }

        var promises = slices.map(function(sliceOfIds) {
          return self.fetchDocs(sliceOfIds, fieldSpec);
        });

        return $q.all(promises).then(function(chunks) {
          return [].concat.apply([], chunks);
        });
      }
    };

    // Return factory object
    return Searcher;
  }
})();

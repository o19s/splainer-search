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

    // Splits ids into parallel fetchDocs calls of chunkSize and concatenates results.
    Searcher.prototype._fetchDocsChunked = function(ids, fieldSpec, chunkSize) {
      /*jslint validthis:true*/
      var self = this;
      var slices = [];
      for (var i = 0; i < ids.length; i += chunkSize) {
        slices.push(ids.slice(i, i + chunkSize));
      }
      return $q.all(slices.map(function(slice) {
        return self.fetchDocs(slice, fieldSpec);
      })).then(function(chunks) {
        return [].concat.apply([], chunks);
      });
    };

    // Normalizes docs returned by a resolver searcher, creating placeholder stubs
    // for any requested IDs that were not found in the response.
    Searcher.prototype._normalizeFetchedDocs = function(ids, fieldSpec, resolverSearcher) {
      var idsToDocs = {};
      angular.forEach(resolverSearcher.docs, function(doc) {
        var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
        idsToDocs[normalDoc.id] = normalDoc;
      });
      return ids.map(function(docId) {
        return idsToDocs.hasOwnProperty(docId)
          ? idsToDocs[docId]
          : normalDocsSvc.createPlaceholderDoc(docId, 'Missing Doc: ' + docId);
      });
    };

    // Extract the raw field-value pairs from an engine-specific doc wrapper for
    // use by validateUrl(). Overridden by each engine-specific searcher factory.
    Searcher.prototype._extractSourceDoc = function(doc) {
      return doc.doc;
    };

    // Validates the configured search URL by executing a test search and
    // populating self.fields (all discovered fields) and self.idFields
    // (fields common to every returned document — candidates for a unique ID field).
    Searcher.prototype.validateUrl = function() {
      /*jslint validthis:true*/
      var self = this;
      self.fields   = [];
      self.idFields = [];
      return self.search().then(function() {
        var candidateIds;
        angular.forEach(self.docs, function(doc) {
          var attributes = Object.keys(self._extractSourceDoc(doc));
          if (angular.isUndefined(candidateIds)) {
            candidateIds = attributes;
          } else {
            candidateIds = candidateIds.filter(function(v) {
              return attributes.indexOf(v) !== -1;
            });
          }
          self.fields = self.fields.concat(attributes.filter(function(attr) {
            return self.fields.indexOf(attr) < 0;
          }));
        });
        self.idFields = candidateIds || [];
      });
    };

    // Return factory object
    return Searcher;
  }
})();

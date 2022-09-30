'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('SettingsValidatorFactory', [
      'fieldSpecSvc',
      'searchSvc',
      SettingsValidatorFactory
    ]);

  function SettingsValidatorFactory(fieldSpecSvc, searchSvc) {
    var Validator = function(settings) {
      var self  = this;

      self.searchUrl    = settings.searchUrl;
      self.searchEngine = settings.searchEngine;
      self.apiMethod    = settings.apiMethod;
      self.version      = settings.version;
      self.apiKey       = settings.apiKey;

      self.searcher = null;
      self.fields   = [];
      self.idFields = [];

      self.setupSearcher  = setupSearcher;
      self.validateUrl    = validateUrl;

      self.setupSearcher();

      function setupSearcher () {
        var args    = { };
        var fields  = '*';

        if ( self.searchEngine === 'solr' ) {
          args = { q: ['*:*'] };
        } else if ( self.searchEngine === 'es' || self.searchEngine === 'os') {
          fields = null;
        }

        self.searcher = searchSvc.createSearcher(
          fieldSpecSvc.createFieldSpec(fields),
          self.searchUrl,
          args,
          '',
          {
            version: self.version,
            apiMethod: self.apiMethod
          },
          self.searchEngine,
          self.apiKey
        );
      }

      function sourceDoc(doc) {
        if ( self.searchEngine === 'solr' ) {
          return doc.doc;
        } else if (self.searchEngine === 'es' || self.searchEngine === 'os') {
          return doc.doc._source;
        } else if (self.searchEngine === 'ec') {
          return doc.doc._source;
        }
      }

      function intersection(a, b) {
        var intersect = a.filter(function(aVal) {
          return b.indexOf(aVal) !== -1;
        });
        return intersect;
      }

      function updateCandidateIds(candidateIds, attributes) {
        if (angular.isUndefined(candidateIds)) {
          return attributes;
        }
        // Guarantee that the candidateIds set occurs in every field
        return intersection(candidateIds, attributes);
      }

      function validateUrl () {
        return self.searcher.search()
        .then(function () {
          var candidateIds;

          // Merge fields from multiple docs because some docs might not return
          // the entire list of fields possible.
          // This is not perfect as the top 10 results might not include
          // a comprehensive list, but it's the best we can do.
          angular.forEach(self.searcher.docs, function(doc) {
            var attributes = Object.keys(sourceDoc(doc));
            candidateIds = updateCandidateIds(candidateIds, attributes);

            self.fields = self.fields.concat(attributes.filter(function (attribute) {
              return self.fields.indexOf(attribute) < 0;
            }));
          });
          self.idFields = candidateIds;
          if (self.searchEngine === 'es' || self.searchEngine === 'os') {
            self.fields.unshift('_id');
            self.idFields.unshift('_id');
          }
        });
      }
    };

    // Return factory object
    return Validator;
  }
})();

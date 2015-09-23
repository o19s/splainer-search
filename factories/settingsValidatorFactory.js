'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('SettingsValidatorFactory', [
      'searchSvc',
      SettingsValidatorFactory
    ]);

  function SettingsValidatorFactory(searchSvc) {
    var Validator = function(settings) {
      var self  = this;

      self.searchUrl    = settings.searchUrl;
      self.searchEngine = settings.searchEngine;

      self.searcher = null;
      self.fields   = [];

      self.setupSearcher  = setupSearcher;
      self.validateUrl    = validateUrl;

      self.setupSearcher();

      function setupSearcher () {
        var args    = { };
        var fields  = '*';

        if ( self.searchEngine == 'solr' ) {
          args = { q: ['*:*'] };
        } else if ( self.searchEngine == 'es' ) {
          fields = null;
        }

        self.searcher = searchSvc.createSearcher(
          fields,
          self.searchUrl,
          args,
          '',
          {},
          self.searchEngine
        );
      }

      function validateUrl () {
        return self.searcher.search()
        .then(function () {
          // Merge fields from multiple docs because some docs might not return
          // the entire list of fields possible.
          // This is not perfect as the top 10 results might not include
          // a comprehensive list, but it's the best we can do.
          if ( self.searchEngine == 'solr' ) {
            angular.forEach(self.searcher.docs, function(doc) {
              var attributes = Object.keys(doc.doc);

              self.fields = self.fields.concat(attributes.filter(function (attribute) {
                return self.fields.indexOf(attribute) < 0;
              }));
            });
          } else if ( self.searchEngine == 'es' ) {
            self.fields.push("_id");

            angular.forEach(self.searcher.docs, function(doc) {
              var attributes = Object.keys(doc.doc._source);
              self.fields = self.fields.concat(attributes.filter(function (attribute) {
                return self.fields.indexOf(attribute) < 0;
              }));
            });
          }
        });
      }
    };

    // Return factory object
    return Validator;
  }
})();

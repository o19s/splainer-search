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

      self.searchUrl      = settings.searchUrl;
      self.searchEngine   = settings.searchEngine;
      self.apiMethod      = settings.apiMethod;
      self.version        = settings.version;
      self.customHeaders  = settings.customHeaders;
      
      // we shouldn't unpack and set these settings to local variables (like above!)
      // because sometimes we don't know what they are all.  For example
      // for the searchapi we need to pass a bunch of extra settings through
      // to the searcher
      self.settings       = settings;
      
      if (settings.args){
        self.args = settings.args;
      }

      self.searcher = null;
      self.fields   = [];
      self.idFields = [];

      self.setupSearcher  = setupSearcher;
      self.validateUrl    = validateUrl;

      self.setupSearcher();

      function setupSearcher () {
        var args    = { };
        var fields  = '*';
        
        // Did we pass in some args externally that we want to use instead
        if (self.args) {
          args = self.args;
        }

        if ( self.searchEngine === 'solr' ) {
          args = { q: ['*:*'] };
        } else if ( self.searchEngine === 'es' || self.searchEngine === 'os') {
          fields = null;
        } else if ( self.searchEngine === 'vectara') {
          
          // When we have a caseOptions or engineOptions hash available, then this could look like "corpusId: '#$searchOptions['corpusId]##"
          args = { query: [
              {
                query: '#$query##',
                numResults: 10,
                corpusKey :[{
                  corpusId: 1
                }]
              }
            ]};
        }
        
        self.searcher = searchSvc.createSearcher(
          fieldSpecSvc.createFieldSpec(fields),
          self.searchUrl,
          args,
          '',
          self.settings,
          self.searchEngine
        );
      }

      function sourceDoc(doc) {
        if ( self.searchEngine === 'solr' ) {
          return doc.doc;
        } else if (self.searchEngine === 'es' || self.searchEngine === 'os') {
          return doc.doc._source;
        } else if ( self.searchEngine === 'vectara' ) {
          // Vectara returns doc properties in a metadata array of objects containing 'name' + 'value pairs
          const fieldsFromDocumentMetadata = doc.doc.metadata.reduce(function(map, obj) {
            map[obj.name] = obj.value;
            return map;
          }, {});
          return Object.assign({}, {
            'id': doc.doc.id
          }, fieldsFromDocumentMetadata);
        }
        else if ( self.searchEngine === 'searchapi' ) {
          return doc.doc;
        }
        else {
          console.error('Need to determine how to source a doc for this search engine ' + self.searchEngine);
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

'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('ResolverFactory', [
      '$q',
      '$log',
      'searchSvc',
      'solrUrlSvc',
      'normalDocsSvc',
      ResolverFactory
    ]);

  function ResolverFactory($q, $log, searchSvc, solrUrlSvc, normalDocsSvc) {
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

      if ( self.settings.searchEngine === undefined || self.settings.searchEngine === 'solr' ) {
        var escapeIds = function(ids) {
          var newIds = [];
          angular.forEach(ids, function(id) {
            // SUSS_USE_OF_ESCAPING.  Going to disable this and see what happens.
            // newIds.push(solrUrlSvc.escapeUserQuery(id));
            newIds.push(id);
          });
          return newIds;
        };

        var allIdsLuceneQuery = self.fieldSpec.id + ':(';
        allIdsLuceneQuery += escapeIds(ids).join(' OR ');
        allIdsLuceneQuery += ')';
        self.queryText = allIdsLuceneQuery;

        self.args = {
          defType: ['lucene'],
          rows: [ids.length],
          q: ['#$query##']
        };
      } else if ( settings.searchEngine === 'es' ||  settings.searchEngine === 'os') {
        self.args = {
          query: {
            terms: {
              [self.fieldSpec.id]: ids,
            },
          },
          size: ids.length,
        };
      } else if ( settings.searchEngine === 'vectara' || settings.searchEngine === 'searchapi') {
        // Some search endpoints do not have an endpoint to retrieve per doc metadata directly
        // by not populating the args, this appears to behave.
      } else if (settings.searchEngine === 'algolia') {
        // Algolia requires separate endpoint to fetch record by IDs. For this we will 
        // set up a flag to indicate to searchFactory about our intent to retrieve records.
        self.args = {
          objectIds: ids,
          retrieveObjects: true
        };
      } else if (settings.searchEngine === 'a2') {
        self.args = {
          text: self.queryText,
            catalog: [
              ids
              ]
        }
      }

      self.config = {
        sanitize:     false,
        highlight:    false,
        debug:        false,
        escapeQuery:  false,
        numberOfRows: ids.length,
        version:      self.settings.version,
        proxyUrl:      self.settings.proxyUrl,
        customHeaders: self.settings.customHeaders,
        apiMethod:    self.settings.apiMethod
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
        if ( self.chunkSize === undefined ) {
          return self.searcher.search()
            .then(function() {
              var newDocs = self.searcher.docs;
              self.docs.length = 0;
              var idsToDocs = {};
              angular.forEach(newDocs, function(doc) {
                var normalDoc = normalDocsSvc.createNormalDoc(self.fieldSpec, doc);
                idsToDocs[normalDoc.id] = normalDoc;
              });

              // Push either the doc from solr or a missing doc stub
              angular.forEach(ids, function(docId) {
                if (idsToDocs.hasOwnProperty(docId)) {
                  self.docs.push(idsToDocs[docId]);
                } else {
                  var placeholderTitle = 'Missing Doc: ' + docId;
                  var placeholderDoc = normalDocsSvc.createPlaceholderDoc(
                    docId,
                    placeholderTitle
                  );
                  self.docs.push(placeholderDoc);
                }
              });

              return self.docs;
            }).catch(function(response) {
              $log.debug('Failed to fetch docs');
              return response;
            });
        } else {
          var sliceIds = function(ids, chunkSize) {
            if (chunkSize > 0) {
              // chunkSize = chunkSize | 0;
              var slices = [];
              for (var i = 0; i < ids.length; i+= chunkSize) {
                slices.push(ids.slice(i, i + chunkSize));
              }
              return slices;
            }
          };

          var deferred = $q.defer();
          var promises = [];

          angular.forEach(sliceIds(ids, chunkSize), function(sliceOfIds) {
            var resolver = new Resolver(sliceOfIds, settings);
            promises.push(resolver.fetchDocs());
          });

          $q.all(promises)
            .then(function(docsChunk) {
              self.docs = self.docs.concat.apply(self.docs, docsChunk);
              deferred.resolve();
            }).catch(function(response) {
              $log.debug('Failed to fetch docs');
              return response;
            });

          return deferred.promise;
        }
      }
    };

    // Return factory object
    return Resolver;
  }
})();

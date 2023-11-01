'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('VectaraSearcherFactory', [
      '$http',
      '$q',
      '$log',
      'VectaraDocFactory',
      'activeQueries',
      'vectaraSearcherPreprocessorSvc',
      'vectaraUrlSvc',
      'SearcherFactory',
      'transportSvc',
      VectaraSearcherFactory
    ]);

  function VectaraSearcherFactory(
    $http, $q, $log,
    VectaraDocFactory,
    activeQueries,
    vectaraSearcherPreprocessorSvc,
    vectaraUrlSvc,
    SearcherFactory,
    transportSvc
  ) {

    var Searcher = function(options) {
      SearcherFactory.call(this, options, vectaraSearcherPreprocessorSvc);
    };

    Searcher.prototype = Object.create(SearcherFactory.prototype);
    Searcher.prototype.constructor = Searcher; // Reset the constructor

    Searcher.prototype.addDocToGroup    = addDocToGroup;
    Searcher.prototype.pager            = pager;
    Searcher.prototype.search           = search;


    function addDocToGroup (groupedBy, group, vectaraDoc) {
      /*jslint validthis:true*/
      const self = this;

      if (!self.grouped.hasOwnProperty(groupedBy)) {
        self.grouped[groupedBy] = [];
      }

      var found = null;
      angular.forEach(self.grouped[groupedBy], function(groupedDocs) {
        if (groupedDocs.value === group && !found) {
          found = groupedDocs;
        }
      });

      if (!found) {
        found = {docs:[], value:group};
        self.grouped[groupedBy].push(found);
      }

      found.docs.push(vectaraDoc);
    }

    // return a new searcher that will give you
    // the next page upon search(). To get the subsequent
    // page, call pager on that searcher
    function pager (){
      /*jslint validthis:true*/
      const self      = this;
      let pagerArgs = {};
      let nextArgs  = angular.copy(self.args);

      if (nextArgs.hasOwnProperty('pager') && nextArgs.pager !== undefined) {
        pagerArgs = nextArgs.pager;
      } else if (self.hasOwnProperty('pagerArgs') && self.pagerArgs !== undefined) {
        pagerArgs = self.pagerArgs;
      }

      if (pagerArgs.hasOwnProperty('from')) {
        pagerArgs.from = parseInt(pagerArgs.from) + pagerArgs.size;

        if (pagerArgs.from >= self.numFound) {
          return null; // no more results
        }
      } else {
        pagerArgs.from = pagerArgs.size;
      }

      nextArgs.pager      = pagerArgs;
      var options         = {
        args:       nextArgs,
        config:     self.config,
        fieldList:  self.fieldList,
        queryText:  self.queryText,
        type:       self.type,
        url:        self.url,
      };

      return new Searcher(options);
    }

    // search (execute the query) and produce results
    // to the returned future
    function search () {
      /*jslint validthis:true*/
      const self= this;
      var apiMethod = 'POST';
      var proxyUrl  = self.config.proxyUrl;
      var url       = self.url;
      var transport = transportSvc.getTransport({apiMethod: apiMethod, proxyUrl: proxyUrl});

      var queryDslWithPagerArgs = angular.copy(self.queryDsl);
      if (self.pagerArgs) {
        queryDslWithPagerArgs.from = self.pagerArgs.from;
        queryDslWithPagerArgs.size = self.pagerArgs.size;
      }

      self.inError  = false;

      const headers = vectaraUrlSvc.getHeaders(self.config.customHeaders);

      activeQueries.count++;
      return transport.query(url, queryDslWithPagerArgs, headers)
        .then(function success(httpConfig) {
          var data = httpConfig.data;
          activeQueries.count--;

          const documents = data.responseSet && data.responseSet.length > 0 ? data.responseSet[0].document : [];

          self.numFound = documents.length;

          var parseDoc = function(doc, groupedBy, group) {
            var options = {
              groupedBy:          groupedBy,
              group:              group,
              fieldList:          self.fieldList,
              url:                self.url
            };

            return new VectaraDocFactory(doc, options);
          };

          angular.forEach(documents, function(docFromApi) {
            const doc = parseDoc(docFromApi);
            self.docs.push(doc);
          });

        }, function error(msg) {
          activeQueries.count--;
          self.inError = true;
          msg.searchError = 'Error with Vectara query or server. Review request manually.';
          return $q.reject(msg);
        })
        .catch(function(response) {
          $log.debug('Failed to execute search');
          return $q.reject(response);
        });
    } // end of search()

    // Return factory object
    return Searcher;
  }
})();

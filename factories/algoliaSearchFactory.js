'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('AlgoliaSearcherFactory', [
      '$q',
      '$log',
      'AlgoliaDocFactory',
      'activeQueries',
      'algoliaSearcherPreprocessorSvc',
      'esUrlSvc',
      'SearcherFactory',
      'transportSvc',
      AlgoliaSearcherFactory
    ]);

  function AlgoliaSearcherFactory(
    $q,
    $log,
    AlgoliaDocFactory,
    activeQueries,
    algoliaSearcherPreprocessorSvc,
    esUrlSvc,
    SearcherFactory,
    transportSvc
  ) {

    var Searcher = function(options) {
      SearcherFactory.call(this, options, algoliaSearcherPreprocessorSvc);
    };

    Searcher.prototype = Object.create(SearcherFactory.prototype);
    Searcher.prototype.constructor = Searcher; // Reset the constructor

    Searcher.prototype.addDocToGroup    = addDocToGroup;
    Searcher.prototype.pager            = pager;
    Searcher.prototype.search           = search;
    // Searcher.prototype.explainOther     = explainOther;
    // Searcher.prototype.explain          = explain;
    // Searcher.prototype.majorVersion     = majorVersion;
    // Searcher.prototype.isTemplateCall   = isTemplateCall;
    // Searcher.prototype.renderTemplate   = renderTemplate;


    /* jshint unused: false */
    function addDocToGroup (groupedBy, group, algoliaDoc) {
      /*jslint validthis:true*/
      console.log('addDocToGroup');
    }

    // return a new searcher that will give you
    // the next page upon search(). To get the subsequent
    // page, call pager on that searcher
    function pager (){
      /*jslint validthis:true*/
      var self = this;
      var page = 0;
      var nextArgs = angular.copy(self.args);

      if (nextArgs.hasOwnProperty('page') && nextArgs.page >= 0) {
        page = nextArgs.page;
      }

      if (page !== undefined && page >= 0) {
        page = parseInt(page) + 1;
        if (page > self.nbPages - 1) {
          return null; // no more results
        }
      } else {
        page = 0;
      }

      nextArgs.page = page;
      var options = {
        args: nextArgs,
        config: self.config,
        queryText:  self.queryText,
        type: self.type,
        url: self.url
      };

      var nextSearcher = new Searcher(options);
      return nextSearcher;
    }

    // search (execute the query) and produce results
    // to the returned future
    function search () {
      /*jslint validthis:true*/


      const self= this;
      var apiMethod = self.config.apiMethod;
      var proxyUrl  = self.config.proxyUrl;
      var url       = self.url;
      var uri       = esUrlSvc.parseUrl(self.url);
      var transport = transportSvc.getTransport({apiMethod: apiMethod, proxyUrl: proxyUrl});


      var payload = self.queryDsl;
      var queryDslWithPagerArgs = angular.copy(self.queryDsl);
      if (self.pagerArgs) {
        queryDslWithPagerArgs.page = self.pagerArgs.page;
        queryDslWithPagerArgs.size = self.pagerArgs.size;
      }

      //var baseUrl = solrUrlSvc.buildUrl(url, self.args);
      url       = esUrlSvc.buildUrl(uri);

      //baseUrl = queryTemplateSvc.hydrate(baseUrl, self.queryText, {encodeURI: true, defaultKw: '""'});
      self.inError  = false;

      var headers = esUrlSvc.getHeaders(uri, self.config.customHeaders);

      activeQueries.count++;

      return transport.query(url, payload, headers)
        .then(function success(httpConfig) {
          const data = httpConfig.data;

          self.lastResponse = data;

          activeQueries.count--;

          self.numFound = data.nbHits;
          self.nbPages = data.nbPages;

          var parseDoc = function(doc) {
            var options = {
              fieldList:          self.fieldList,
            };
            return new AlgoliaDocFactory(doc, options);
          };

          let  mappedDocs = [];

          function docMapper(algoliaDoc) {
            return Object.assign({}, algoliaDoc, {
              id: algoliaDoc.objectID
            });
          }

          data.hits.forEach(function(item) {
            mappedDocs.push(docMapper(item));
          });

          angular.forEach(mappedDocs, function(mappedDoc) {
            const doc = parseDoc(mappedDoc);
            self.docs.push(doc);
          });

        }, function error(msg) {
          console.log('Error');
          activeQueries.count--;
          self.inError = true;
          msg.searchError = 'Error with Search API query or server. Review request manually.';
          return $q.reject(msg);
        })
        .catch(function(response) {
          $log.debug('Failed to execute search: ' + response.type + ':' + response.message);
          return $q.reject(response);
        });
    } // end of search()

    // Return factory object
    return Searcher;
  }
})();

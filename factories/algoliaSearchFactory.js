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
    Searcher.prototype.getTransportParameters = getTransportParameters;

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

    function getIndexName (url) {
      var pathFragments = (new URL(url)).pathname.split('/').filter(function (item) {
        return item.length > 0;
      });

      return pathFragments[pathFragments.length - 2];
    }

    function constructObjectQueryUrl(url) {
      var urlObject = new URL(url);
      urlObject.pathname = '/1/indexes/*/objects';
      return urlObject.toString();
    }

    function getTransportParameters(retrieveObjects) {
      var self = this;
      var uri = esUrlSvc.parseUrl(self.url);
      var url       = esUrlSvc.buildUrl(uri);
      var headers = esUrlSvc.getHeaders(uri, self.config.customHeaders);
      var payload = {};

      if (retrieveObjects) {
        var indexName = getIndexName(url);
        var objectsUrl = constructObjectQueryUrl(url);

        var attributesToRetrieve = self.queryDsl && self.queryDsl.attributesToRetrieve ? self.queryDsl.attributesToRetrieve:undefined;

        payload = {
          requests: self.args.objectIds.map(id => {
            return {
              indexName: indexName,
              objectID: id,
              attributesToRetrieve: attributesToRetrieve
            };
          })
        };

        return {
          url: objectsUrl,
          headers: headers,
          payload: payload,
          responseKey: 'results',
        };
      } else {
        payload = self.queryDsl;
        return {
          url: url,
          headers: headers,
          payload: payload,
          responseKey: 'hits',
        };
      }
    }

    // search (execute the query) and produce results
    // to the returned future
    function search () {
      /*jslint validthis:true*/

      const self = this;
      var apiMethod = self.config.apiMethod;
      var proxyUrl  = self.config.proxyUrl;
      var transport = transportSvc.getTransport({ apiMethod: apiMethod, proxyUrl: proxyUrl });

      var retrieveObjects = self.args.retrieveObjects;

      var transportParameters = self.getTransportParameters(retrieveObjects);

      self.inError = false;

      activeQueries.count++;

      return transport.query(transportParameters.url, transportParameters.payload, transportParameters.headers)
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

          data[transportParameters.responseKey].forEach(function(item) {
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
          msg.searchError = 'Error with Algolia query or API endpoint. Review request manually.';
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

'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('EsSearcherFactory', [
      '$http',
      '$q',
      'EsDocFactory',
      'activeQueries',
      'esSearcherPreprocessorSvc',
      'esUrlSvc',
      'SearcherFactory',
      'transportSvc',
      EsSearcherFactory
    ]);

  function EsSearcherFactory($http, $q, EsDocFactory, activeQueries, esSearcherPreprocessorSvc, esUrlSvc, SearcherFactory, transportSvc) {

    var Searcher = function(options) {
      SearcherFactory.call(this, options, esSearcherPreprocessorSvc);
    };

    Searcher.prototype = Object.create(SearcherFactory.prototype);
    Searcher.prototype.constructor = Searcher; // Reset the constructor


    Searcher.prototype.addDocToGroup    = addDocToGroup;
    Searcher.prototype.pager            = pager;
    Searcher.prototype.search           = search;


    function addDocToGroup (groupedBy, group, solrDoc) {
      /*jslint validthis:true*/
      var self = this;

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

      found.docs.push(solrDoc);
    }

    // return a new searcher that will give you
    // the next page upon search(). To get the subsequent
    // page, call pager on that searcher ad infinidum
    function pager () {
      /*jslint validthis:true*/
      var self      = this;
      var pagerArgs = { from: 0, size: 10 };
      var nextArgs  = angular.copy(self.args);

      if (nextArgs.hasOwnProperty('pager') && nextArgs.pager !== undefined) {
        pagerArgs = nextArgs.pager;
      } else if (self.hasOwnProperty('pagerArgs') && self.pagerArgs !== undefined) {
        pagerArgs = self.pagerArgs;
      }

      if (pagerArgs.hasOwnProperty('from')) {
        pagerArgs.from = parseInt(pagerArgs.from) + 10;

        if (pagerArgs.from >= self.numFound) {
          return null; // no more results
        }
      } else {
        pagerArgs.from = 10;
      }

      var remaining       = self.numFound - pagerArgs.from;
      pagerArgs.size      = Math.min(pagerArgs.size, remaining);
      nextArgs.pager      = pagerArgs;

      var options = {
        fieldList:  self.fieldList,
        url:        self.url,
        args:       nextArgs,
        queryText:  self.queryText,
      };

      var nextSearcher = new Searcher(options);

      return nextSearcher;
    }

    // search (execute the query) and produce results
    // to the returned future
    function search () {
      /*jslint validthis:true*/
      var self      = this;
      var url       = self.url;
      var uri = esUrlSvc.parseUrl(url);
      url = esUrlSvc.buildUrl(uri);
      var transport = transportSvc.getTransport({searchApi: uri.searchApi});
      var queryDslWithPagerArgs = angular.copy(self.queryDsl);
      if (self.pagerArgs) {
        queryDslWithPagerArgs.from = self.pagerArgs.from;
        queryDslWithPagerArgs.size = self.pagerArgs.size;
      }
      self.inError  = false;

      var thisSearcher  = self;

      var getExplData = function(doc) {
        if (doc.hasOwnProperty('_explanation')) {
          return doc._explanation;
        }
        else {
          return null;
        }
      };

      var getHlData = function(doc) {
        if (doc.hasOwnProperty('highlight')) {
          return doc.highlight;
        } else {
          return null;
        }
      };

      // Build URL with params if any
      // Eg. without params:  /_search
      // Eg. with params:     /_search?size=5&from=5
      //esUrlSvc.setParams(uri, self.pagerArgs);

      var headers = {};

      if ( angular.isDefined(uri.username) && uri.username !== '' &&
        angular.isDefined(uri.password) && uri.password !== '') {
        var authorization = 'Basic ' + btoa(uri.username + ':' + uri.password);
        headers = { 'Authorization': authorization };
      }

      activeQueries.count++;
      return transport.query(url, queryDslWithPagerArgs, headers)
      .then(function success(httpConfig) {
        var data = httpConfig.data;
        activeQueries.count--;
        self.numFound = data.hits.total;

        var parseDoc = function(doc, groupedBy, group) {
          var explDict  = getExplData(doc);
          var hlDict    = getHlData(doc);

          var options = {
            groupedBy:          groupedBy,
            group:              group,
            fieldList:          self.fieldList,
            url:                self.url,
            explDict:           explDict,
            hlDict:             hlDict,
          };

          return new EsDocFactory(doc, options);
        };

        angular.forEach(data.hits.hits, function(hit) {
          var doc = parseDoc(hit);
          thisSearcher.docs.push(doc);
        });

        if ( angular.isDefined(data._shards) && data._shards.failed > 0 ) {
          return $q.reject(data._shards.failures[0]);
        }
      }, function error(msg) {
        activeQueries.count--;
        thisSearcher.inError = true;
        return $q.reject(msg);
      });
    }

    // Return factory object
    return Searcher;
  }
})();

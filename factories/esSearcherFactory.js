'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('EsSearcherFactory', [
      '$http',
      '$q',
      '$log',
      'EsDocFactory',
      'activeQueries',
      'esSearcherPreprocessorSvc',
      'esUrlSvc',
      'SearcherFactory',
      'transportSvc',
      EsSearcherFactory
    ]);

  function EsSearcherFactory(
    $http, $q, $log,
    EsDocFactory,
    activeQueries,
    esSearcherPreprocessorSvc, esUrlSvc,
    SearcherFactory,
    transportSvc
  ) {

    var Searcher = function(options) {
      SearcherFactory.call(this, options, esSearcherPreprocessorSvc);
    };

    Searcher.prototype = Object.create(SearcherFactory.prototype);
    Searcher.prototype.constructor = Searcher; // Reset the constructor


    Searcher.prototype.addDocToGroup    = addDocToGroup;
    Searcher.prototype.pager            = pager;
    Searcher.prototype.search           = search;
    Searcher.prototype.explainOther     = explainOther;
    Searcher.prototype.explain          = explain;
    Searcher.prototype.majorVersion     = majorVersion;


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
      var pagerArgs = { from: 0, size: self.config.numberOfRows };
      var nextArgs  = angular.copy(self.args);

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

      var nextSearcher = new Searcher(options);

      return nextSearcher;
    }

    // search (execute the query) and produce results
    // to the returned future
    function search () {
      /*jslint validthis:true*/
      var self      = this;
      var uri       = esUrlSvc.parseUrl(self.url);
      var apiMethod = self.config.apiMethod;

      if ( esUrlSvc.isBulkCall(uri) ) {
        apiMethod = 'bulk';
      }

      // Using templates assumes that the _source field is defined
      // in the template, not passed in
      if (apiMethod === 'get' && !esUrlSvc.isTemplateCall(uri)) {
        var fieldList = (self.fieldList === '*') ? '*' : self.fieldList.join(',');

        if ( 5 <= self.majorVersion() ) {
          /*jshint camelcase: false */
          esUrlSvc.setParams(uri, {
            _source:       fieldList,
          });
        } else {
          esUrlSvc.setParams(uri, {
            _source: fieldList,
          });
        }
      }

      var url       = esUrlSvc.buildUrl(uri);
      var transport = transportSvc.getTransport({apiMethod: apiMethod});

      var queryDslWithPagerArgs = angular.copy(self.queryDsl);
      if (self.pagerArgs) {
        queryDslWithPagerArgs.from = self.pagerArgs.from;
        queryDslWithPagerArgs.size = self.pagerArgs.size;
      }

      if (esUrlSvc.isTemplateCall(uri)) {
        console.log("DUDE:");
        console.log(queryDslWithPagerArgs);
        delete queryDslWithPagerArgs._source;
        delete queryDslWithPagerArgs.highlight;
      }

      self.inError  = false;

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

      var getQueryParsingData = function(data) {
        if (data.hasOwnProperty('profile')) {
          return data.profile;
        }
        else {
          return {};
        }
      };

      var formatError = function(msg) {
          var errorMsg = '';
          if (msg) {
            if (msg.status >= 400) {
              errorMsg = 'HTTP Error: ' + msg.status + ' ' + msg.statusText;
            }
            if (msg.status > 0) {
              if (msg.hasOwnProperty('data') && msg.data) {

                if (msg.data.hasOwnProperty('error')) {
                  errorMsg += '\n' + JSON.stringify(msg.data.error, null, 2);
                }
                if (msg.data.hasOwnProperty('_shards')) {
                  angular.forEach(msg.data._shards.failures, function(failure) {
                    errorMsg += '\n' + JSON.stringify(failure, null, 2);
                  });
                }

              }
            }
            else if (msg.status === -1 || msg.status === 0) {
              errorMsg +=  'Network Error! (host not found)\n';
              errorMsg += '\n';
              errorMsg +=  'or CORS needs to be configured for your Elasticsearch\n';
              errorMsg +=  '\n';
              errorMsg +=  'Enable CORS in elasticsearch.yml:\n';
              errorMsg += '\n';
              errorMsg += 'http.cors.allow-origin: "/https?:\\\\/\\\\/(.*?\\\\.)?(quepid\\\\.com|splainer\\\\.io)/"\n';
              errorMsg += 'http.cors.enabled: true\n';
            }
            msg.searchError = errorMsg;
          }
          return msg;
      };

      // Build URL with params if any
      // Eg. without params:  /_search
      // Eg. with params:     /_search?size=5&from=5
      //esUrlSvc.setParams(uri, self.pagerArgs);

      var headers = esUrlSvc.getHeaders(uri);

      activeQueries.count++;
      return transport.query(url, queryDslWithPagerArgs, headers)
        .then(function success(httpConfig) {
          var data = httpConfig.data;
          activeQueries.count--;
          if (data.hits.hasOwnProperty('total') && data.hits.total.hasOwnProperty('value')) {
            self.numFound = data.hits.total.value;
          }
          else {
            self.numFound = data.hits.total;
          }
          self.parsedQueryDetails = getQueryParsingData(data);

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
              version:            self.majorVersion(),
            };

            return new EsDocFactory(doc, options);
          };

          angular.forEach(data.hits.hits, function(hit) {
            var doc = parseDoc(hit);
            self.docs.push(doc);
          });

          if ( angular.isDefined(data._shards) && data._shards.failed > 0 ) {
            return $q.reject(formatError(httpConfig));
          }
        }, function error(msg) {
          activeQueries.count--;
          self.inError = true;
          return $q.reject(formatError(msg));
        })
        .catch(function(response) {
          $log.debug('Failed to execute search');
          return $q.reject(response);
        });
    } // end of search()

    function explainOther (otherQuery) {
      /*jslint validthis:true*/
      var self = this;

      var otherSearcherOptions = {
        fieldList:  self.fieldList,
        url:        self.url,
        args:       self.args,
        queryText:  otherQuery,
        config:     {
          apiMethod:    'post',
          numberOfRows: self.config.numberOfRows,
          version:      self.config.version,
        },
        type:       self.type,
      };

      if ( angular.isDefined(self.pagerArgs) && self.pagerArgs !== null ) {
        otherSearcherOptions.args.pager = self.pagerArgs;
      }

      var otherSearcher = new Searcher(otherSearcherOptions);

      return otherSearcher.search()
        .then(function() {
          self.numFound = otherSearcher.numFound;

          var defer     = $q.defer();
          var promises  = [];
          var docs      = [];

          angular.forEach(otherSearcher.docs, function(doc) {
            var promise = self.explain(doc)
              .then(function(parsedDoc) {
                docs.push(parsedDoc);
              });

            promises.push(promise);
          });

          $q.all(promises)
            .then(function () {
              self.docs = docs;
              defer.resolve();
            });

          return defer.promise;
        }).catch(function(response) {
          $log.debug('Failed to run explainOther');
          return response;
        });
    } // end of explainOther()

    function explain(doc) {
      /*jslint validthis:true*/
      var self    = this;
      var uri     = esUrlSvc.parseUrl(self.url);
      var url     = esUrlSvc.buildExplainUrl(uri, doc);
      var headers = esUrlSvc.getHeaders(uri);

      return $http.post(url, { query: self.queryDsl.query }, {headers: headers})
        .then(function(response) {
          var explDict  = response.data.explanation || null;

          var options = {
            fieldList: self.fieldList,
            url:       self.url,
            explDict:  explDict,
          };

          return new EsDocFactory(doc, options);
        }).catch(function(response) {
          $log.debug('Failed to run explain');
          return response;
        });
    } // end of explain()

    function majorVersion() {
      var self = this;

      if ( angular.isDefined(self.config) &&
        angular.isDefined(self.config.version) &&
        self.config.version !== null &&
        self.config.version !== ''
      ) {
        return parseInt(self.config.version.split('.')[0]);
      } else {
        return null;
      }
    }

    // Return factory object
    return Searcher;
  }
})();

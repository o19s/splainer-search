'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('SolrSearcherFactory', [
      '$q',
      '$log',
      'SolrDocFactory',
      'SearcherFactory',
      'transportSvc',
      'activeQueries',
      'defaultSolrConfig',
      'solrSearcherPreprocessorSvc',
      'esUrlSvc',
      SolrSearcherFactory
    ]);

  function SolrSearcherFactory(
    $q, $log,
    SolrDocFactory, SearcherFactory, transportSvc,
    activeQueries, defaultSolrConfig,
    solrSearcherPreprocessorSvc, esUrlSvc
  ) {
    var Searcher = function(options) {
      SearcherFactory.call(this, options, solrSearcherPreprocessorSvc);
    };

    Searcher.prototype = Object.create(SearcherFactory.prototype);
    Searcher.prototype.constructor = Searcher; // Reset the constructor

    Searcher.prototype.addDocToGroup    = addDocToGroup;
    Searcher.prototype.pager            = pager;
    Searcher.prototype.search           = search;
    Searcher.prototype.explainOther     = explainOther;
    Searcher.prototype.queryDetails     = {};
    
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
      var start     = 0;
      var rows      = self.config.numberOfRows;
      var nextArgs  = angular.copy(self.args);

      if (nextArgs.hasOwnProperty('rows') && nextArgs.rows !== null) {
        rows = parseInt(nextArgs.rows);
      }

      if (nextArgs.hasOwnProperty('start') && nextArgs.start !== null) {
        start = parseInt(nextArgs.start) + rows;

        if (start >= self.numFound) {
          return null; // no more results
        }
      } else {
        start = rows;
      }

      nextArgs.rows       = ['' + rows];
      nextArgs.start      = ['' + start];
      var pageConfig      = defaultSolrConfig;
      pageConfig.sanitize = false;
      pageConfig.escapeQuery = self.config.escapeQuery;
      pageConfig.apiMethod   = self.config.apiMethod;

      var options = {
        fieldList:          self.fieldList,
        hlFieldList:        self.hlFieldList,
        url:                self.url,
        args:               nextArgs,
        queryText:          self.queryText,
        config:             pageConfig,
        type:               self.type,
        HIGHLIGHTING_PRE:   self.HIGHLIGHTING_PRE,
        HIGHLIGHTING_POST:  self.HIGHLIGHTING_POST,
      };

      var nextSearcher = new Searcher(options);

      return nextSearcher;
    }

    // search (execute the query) and produce results
    // to the returned future
    function search () {
      /*jslint validthis:true*/
      var self      = this;
      var url       = self.callUrl;
      self.inError  = false;

      var thisSearcher = self;

      var getExplData = function(solrResp) {

        if (solrResp.hasOwnProperty('debug') && solrResp.debug !== null) {
          var dbg = solrResp.debug;
          if (dbg.hasOwnProperty('explain') && dbg.explain !== null) {
            return dbg.explain;
          }
        }
        return {};
      };

      var getOthersExplained = function(solrResp) {
        if (solrResp.hasOwnProperty('debug') && solrResp.debug !== null) {
          var dbg = solrResp.debug;
          if (dbg.hasOwnProperty('explainOther') && dbg.explainOther !== null) {
            return dbg.explainOther;
          }
        }
      };

      // Return information about how long a query took to run.
      // each event has nested tree like {name: 'blah', duration:43, events:[{name: 'foo', duration:20},{name: 'bar', duration:23}]
      var getTimingDetails = function(solrResp) {
        var queryTimingData = {};
        if (solrResp.hasOwnProperty('debug') && solrResp.debug !== null) {
          if (solrResp.debug.hasOwnProperty('timing') && solrResp.debug.timing !== null) {
            var timing = solrResp.debug.timing;
            queryTimingData = {
              name: 'timing',
              duration:timing.time,
              events:[]
            };
            if (timing.hasOwnProperty('prepare') && timing.prepare !== null) {
              let keys = Object.keys(timing.prepare);
              if (timing.prepare.hasOwnProperty('time')) {
                keys.splice('time', 1);
              }
              angular.forEach(keys, function(key) {
                var event = {
                  name: 'prepare_' + key,
                  duration: timing.prepare[key].time
                };
                queryTimingData.events.push(event);
              });
            }

            if (timing.hasOwnProperty('process') && timing.process !== null) {
              let keys = Object.keys(timing.process);
              if (timing.process.hasOwnProperty('time')) {
                keys.splice('time', 1);
              }
              angular.forEach(keys, function(key) {
                var event = {
                  name: 'process_' + key,
                  duration: timing.process[key].time
                };
                queryTimingData.events.push(event);
              });
            }
          }
        }
        return queryTimingData;
      };

      var getQueryDetails = function(solrResp) {
        var queryDetails = {};
        if (solrResp.hasOwnProperty('responseHeader') && solrResp.responseHeader !== null) {
          var responseHeader = solrResp.responseHeader;
          if (responseHeader.hasOwnProperty('params') && responseHeader.params !== null) {
            queryDetails = solrResp.responseHeader.params;
          }
        }
        return queryDetails;
      };

      var getQueryParsingData = function(solrResp) {
        var queryParsingData = {};
        if (solrResp.hasOwnProperty('debug') && solrResp.debug !== null) {
          var keysToIgnore = ['track', 'timing', 'explain', 'explainOther'];
          var dbg = solrResp.debug;
          var keys = Object.keys(dbg);
          angular.forEach(keysToIgnore, function(keyToIgnore) {
            if (dbg.hasOwnProperty(keyToIgnore)) {
              keys.splice(keys.indexOf(keyToIgnore), 1);
            }
          });

          angular.forEach(keys, function(key) {
            queryParsingData[key] = dbg[key];
          });
        }

        if (solrResp.hasOwnProperty('querqy.infoLog') && solrResp['querqy.infoLog'] !== null) {
          queryParsingData['querqy.infoLog'] = solrResp['querqy.infoLog'];
        }
        // Ignores jshint dot notation because it is a valid property name
        /* jshint -W069*/
        if (solrResp.hasOwnProperty('querqy_decorations') && solrResp['querqy_decorations'] !== null) {
          queryParsingData['querqy_decorations'] = solrResp['querqy_decorations'];
        }
        /* jsHint -W069 */
        return queryParsingData;
      };

      var getHlData = function(solrResp) {
        if (solrResp.hasOwnProperty('highlighting') && solrResp.highlighting !== null) {
          return solrResp.highlighting;
        }
        return {};
      };

      activeQueries.count++;
      return $q(function(resolve, reject) {

        var apiMethod = defaultSolrConfig.apiMethod; // Solr defaults to JSONP
        if (self.config && self.config.apiMethod) {
          apiMethod = self.config.apiMethod;
        }
        
        var headers   = null;
        var proxyUrl  = self.config.proxyUrl;
        
        var transport = transportSvc.getTransport({apiMethod: apiMethod, proxyUrl: proxyUrl});
        
        if (apiMethod === 'JSONP'){
          // JSONP is weird.  You don't get headers, and you must embed basic auth IN the url
        }
        else {
          let uri = esUrlSvc.parseUrl(url);
          url     = esUrlSvc.buildUrl(uri);          
          headers = esUrlSvc.getHeaders(uri, self.config.customHeaders);                  
        }

        transport.query(url, null, headers)
          .then(function success(resp) {
            var solrResp = resp.data;
            activeQueries.count--;

            var explDict  = getExplData(solrResp);
            var hlDict    = getHlData(solrResp);
            thisSearcher.othersExplained = getOthersExplained(solrResp);
            thisSearcher.parsedQueryDetails = getQueryParsingData(solrResp);
            thisSearcher.queryDetails = getQueryDetails(solrResp);
            thisSearcher.timingDetails = getTimingDetails(solrResp);

            var parseSolrDoc = function(solrDoc, groupedBy, group) {
              var options = {
                groupedBy:          groupedBy,
                group:              group,
                fieldList:          self.fieldList,
                hlFieldList:        self.hlFieldList,
                url:                self.url,
                explDict:           explDict,
                hlDict:             hlDict,
                highlightingPre:    self.HIGHLIGHTING_PRE,
                highlightingPost:   self.HIGHLIGHTING_POST,
              };

              return new SolrDocFactory(solrDoc, options);
            };

            if (solrResp.hasOwnProperty('response') && solrResp.response !== null) {
              angular.forEach(solrResp.response.docs, function(solrDoc) {
                var doc = parseSolrDoc(solrDoc);
                thisSearcher.numFound = solrResp.response.numFound;
                thisSearcher.docs.push(doc);
              });
            } else if (solrResp.hasOwnProperty('grouped') && solrResp.grouped !== null) {
              angular.forEach(solrResp.grouped, function(groupedBy, groupedByName) {

                thisSearcher.numFound = groupedBy.matches;
                // add docs for a top level group
                //console.log(groupedBy.doclist.docs);
                if (groupedBy.hasOwnProperty('doclist') && groupedBy.doclist !== null) {
                  angular.forEach(groupedBy.doclist.docs, function (solrDoc) {
                    var doc = parseSolrDoc(solrDoc, groupedByName, solrDoc[groupedByName]);
                    thisSearcher.docs.push(doc);
                    thisSearcher.addDocToGroup(groupedByName, solrDoc[groupedByName], doc);
                  });
                }

                // add docs for Field Collapsing results
                angular.forEach(groupedBy.groups, function(groupResp) {
                  var groupValue = groupResp.groupValue;
                  angular.forEach(groupResp.doclist.docs, function(solrDoc) {
                    var doc = parseSolrDoc(solrDoc, groupedByName, groupValue);
                    thisSearcher.docs.push(doc);
                    thisSearcher.addDocToGroup(groupedByName, groupValue, doc);
                  });
                });
              });
            }
            resolve();
          }, function error(msg) {
            activeQueries.count--;
            thisSearcher.inError = true;
            msg.searchError = 'Error with Solr query or server. Contact Solr directly to inspect the error';
            reject(msg);
          }).catch(function(response) {
            $log.debug('Failed to run search');
            return response;
          });
      });
    } // end of search()

    function explainOther (otherQuery, fieldSpec, defType) {
      /*jslint validthis:true*/
      var self = this;

      // var args = angular.copy(self.args);
      self.args.explainOther = [otherQuery];
      solrSearcherPreprocessorSvc.prepare(self);

      // First query carries out the explainOther
      return self.search()
        .then(function() {
          var start = 0;
          var rows  = self.config.numberOfRows;

          if ( angular.isDefined(self.args.rows) && self.args.rows !== null ) {
            rows = self.args.rows;
          }

          if ( angular.isDefined(self.args.start) && self.args.start !== null ) {
            start = self.args.start;
          }
          var solrParams = {
            qf:     [fieldSpec.title + ' ' + fieldSpec.id],
            rows:   [rows],
            start:  [start],
            q:      [otherQuery]
          };

          if (defType) {
            solrParams.defType = defType;
          }

          var otherSearcherOptions = {
            fieldList:          self.fieldList,
            hlFieldList:        self.hlFieldList,
            url:                self.url,
            args:               solrParams,
            queryText:          otherQuery,
            config:             {
              numberOfRows: self.config.numberOfRows
            },
            type:               self.type,
            HIGHLIGHTING_PRE:   self.HIGHLIGHTING_PRE,
            HIGHLIGHTING_POST:  self.HIGHLIGHTING_POST,
          };

          var otherSearcher = new Searcher(otherSearcherOptions);

          // Second query fetches metadata for the explained documents
          return otherSearcher.search()
            .then(function() {
              self.numFound        = otherSearcher.numFound;
              self.docs            = otherSearcher.docs;
            });
        }).catch(function(response) {
          $log.debug('Failed to run explainOther');
          return response;
        });
    }

    // Return factory object
    return Searcher;
  }
})();

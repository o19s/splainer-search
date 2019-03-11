'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('SolrSearcherFactory', [
      '$http',
      '$q',
      'SolrDocFactory',
      'SearcherFactory',
      'activeQueries',
      'defaultSolrConfig',
      'solrSearcherPreprocessorSvc',
      'transportSvc',
      SolrSearcherFactory
    ]);

  function SolrSearcherFactory(
    $http, $q,
    SolrDocFactory, SearcherFactory,
    activeQueries, defaultSolrConfig,
    solrSearcherPreprocessorSvc,
    transportSvc
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

      if (nextArgs.hasOwnProperty('rows')) {
        rows = parseInt(nextArgs.rows);
      }

      if (nextArgs.hasOwnProperty('start')) {
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

      var options = {
        fieldList:          self.fieldList,
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

      var thisSearcher  = self;
      var transport     = transportSvc.getTransport({ apiMethod: 'get' });

      var getExplData = function(solrResp) {
        if (solrResp.hasOwnProperty('debug')) {
          var dbg = solrResp.debug;
          if (dbg.hasOwnProperty('explain')) {
            return dbg.explain;
          }
        }
        return {};
      };

      var getOthersExplained = function(solrResp) {
        if (solrResp.hasOwnProperty('debug')) {
          var dbg = solrResp.debug;
          if (dbg.hasOwnProperty('explainOther')) {
            return dbg.explainOther;
          }
        }
      };

      var getHlData = function(solrResp) {
        if (solrResp.hasOwnProperty('highlighting')) {
          return solrResp.highlighting;
        }
        return {};
      };

      activeQueries.count++;
      return $q(function(resolve, reject) {
        url = 'https://cors-anywhere.quepid.com/' + url;
        transport.query(url).then(function success(resp) {
          var solrResp = resp.data;
          activeQueries.count--;

          var explDict  = getExplData(solrResp);
          var hlDict    = getHlData(solrResp);
          thisSearcher.othersExplained = getOthersExplained(solrResp);

          var parseSolrDoc = function(solrDoc, groupedBy, group) {
            var options = {
              groupedBy:          groupedBy,
              group:              group,
              fieldList:          self.fieldList,
              url:                self.url,
              explDict:           explDict,
              hlDict:             hlDict,
              highlightingPre:    self.HIGHLIGHTING_PRE,
              highlightingPost:   self.HIGHLIGHTING_POST,
            };

            return new SolrDocFactory(solrDoc, options);
          };

          if (solrResp.hasOwnProperty('response')) {
            angular.forEach(solrResp.response.docs, function(solrDoc) {
              var doc = parseSolrDoc(solrDoc);
              thisSearcher.numFound = solrResp.response.numFound;
              thisSearcher.docs.push(doc);
            });
          } else if (solrResp.hasOwnProperty('grouped')) {
            angular.forEach(solrResp.grouped, function(groupedBy, groupedByName) {

              thisSearcher.numFound = groupedBy.matches;
              // add docs for a top level group
              //console.log(groupedBy.doclist.docs);
              if (groupedBy.hasOwnProperty('doclist')) {
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
        });
      });
    } // end of search()

    function explainOther (otherQuery, fieldSpec) {
      /*jslint validthis:true*/
      var self = this;

      // var args = angular.copy(self.args);
      self.args.explainOther = [otherQuery];
      solrSearcherPreprocessorSvc.prepare(self);

      // TODO: revisit why we perform the first search, doesn't seem to have
      // any use!
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

          var otherSearcherOptions = {
            fieldList:          self.fieldList,
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

          return otherSearcher.search()
            .then(function() {
              self.numFound        = otherSearcher.numFound;
              self.docs            = otherSearcher.docs;
            });
        });
    }

    // Return factory object
    return Searcher;
  }
})();

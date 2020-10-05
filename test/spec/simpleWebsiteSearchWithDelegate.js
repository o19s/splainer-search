'use strict';
//#const puppeteer = require('puppeteer');

/*global describe,beforeEach,inject,it,expect*/

describe('Querying a website directly', function () {
    var searchSvc;
    var fieldSpecSvc  = null;
    var mockFieldSpec = null;

    var OSCWebsiteEngine = {
        addDocToGroup: function(){},
        pager: function(){},
        // search (execute the query) and produce results
        // to the returned future
        search: function () {
          /*jslint validthis:true*/
          var self      = this;
          //var url       = self.callUrl;
          var url =     "https://opensourceconnections.com/?s=QUERYPARAM"
          self.inError  = false;

          var thisSearcher = self;

          var getExplData = function(solrResp) {
            return {};
          };

          var getOthersExplained = function(solrResp) {
          };

          var getHlData = function(solrResp) {
            return {};
          };

          activeQueries.count++;
          return $q(function(resolve, reject) {
            var trustedUrl = $sce.trustAsResourceUrl(url);

            $http.jsonp(trustedUrl, { jsonpCallbackParam: 'json.wrf' })
              .then(function success(resp) {
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
              }).catch(function(response) {
                $log.debug('Failed to run search');
                return response;
              });
          });
        } // end of search(),
        explainOther: function(){},
        explain: function(){},
        dude: function(){} // don't need me
    }
    // load the service's module
    beforeEach(module('o19s.splainer-search'));

    beforeEach(inject(function (_searchSvc_, _fieldSpecSvc_) {
        searchSvc     = _searchSvc_;
        fieldSpecSvc  = _fieldSpecSvc_;
        mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1');
    }));

    describe('loads custom searcher', function() {
        beforeEach( () => {
            Window.CustomSearchEngines = {custom: OSCWebsiteEngine};
        })

        it('loads a custom searcher', function(){
            var searcher = searchSvc.createSearcher(
                mockFieldSpec.fieldList,
                "",
                {params:{}},
                "query text",
                {},
                "custom"
              );
            expect(searcher.searchEngine).toEqual("custom")
        })

        it('calls method on a custom searcher', function(){
            var searcher = searchSvc.createSearcher(
                mockFieldSpec.fieldList,
                "",
                {params:{}},
                "query text",
                {},
                "custom"
              );
            expect(searcher.search()).toEqual("OSC website")
        })
    })
});

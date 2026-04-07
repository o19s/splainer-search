'use strict';

/*jslint latedef:false*/

import { isAbortError, transportRequestOpts } from '../services/transportRequestOpts.js';

export function SolrSearcherFactory(
  SolrDocFactory,
  SearcherFactory,
  transportSvc,
  activeQueries,
  defaultSolrConfig,
  solrSearcherPreprocessorSvc,
  esUrlSvc,
  utilsSvc,
) {
  var Searcher = function (options) {
    SearcherFactory.call(this, options, solrSearcherPreprocessorSvc);
  };

  Searcher.prototype = Object.create(SearcherFactory.prototype);
  Searcher.prototype.constructor = Searcher; // Reset the constructor

  Searcher.prototype.addDocToGroup = addDocToGroup;
  Searcher.prototype.pager = pager;
  Searcher.prototype.search = search;
  Searcher.prototype.explainOther = explainOther;
  Searcher.prototype.queryDetails = {};

  function addDocToGroup(groupedBy, group, solrDoc) {
    /*jslint validthis:true*/
    var self = this;

    if (!Object.hasOwn(self.grouped, groupedBy)) {
      self.grouped[groupedBy] = [];
    }

    var found = null;
    utilsSvc.safeForEach(self.grouped[groupedBy], function (groupedDocs) {
      if (groupedDocs.value === group && !found) {
        found = groupedDocs;
      }
    });

    if (!found) {
      found = { docs: [], value: group };
      self.grouped[groupedBy].push(found);
    }

    found.docs.push(solrDoc);
  }

  // return a new searcher that will give you
  // the next page upon search(). To get the subsequent
  // page, call pager on that searcher ad infinidum
  function pager() {
    /*jslint validthis:true*/
    var self = this;
    var start = 0;
    var rows = self.config.numberOfRows;
    var nextArgs = utilsSvc.deepClone(self.args);

    if (Object.hasOwn(nextArgs, 'rows') && nextArgs.rows !== null) {
      rows = parseInt(nextArgs.rows);
    }

    if (Object.hasOwn(nextArgs, 'start') && nextArgs.start !== null) {
      start = parseInt(nextArgs.start) + rows;

      if (start >= self.numFound) {
        return null; // no more results
      }
    } else {
      start = rows;
    }

    nextArgs.rows = ['' + rows];
    nextArgs.start = ['' + start];
    var pageConfig = utilsSvc.deepClone(defaultSolrConfig);
    pageConfig.sanitize = false;
    pageConfig.escapeQuery = self.config.escapeQuery;
    pageConfig.apiMethod = self.config.apiMethod;
    if (self.config && self.config.signal !== undefined) {
      pageConfig.signal = self.config.signal;
    }

    var options = {
      fieldList: self.fieldList,
      hlFieldList: self.hlFieldList,
      url: self.url,
      args: nextArgs,
      queryText: self.queryText,
      config: pageConfig,
      type: self.type,
      HIGHLIGHTING_PRE: self.HIGHLIGHTING_PRE,
      HIGHLIGHTING_POST: self.HIGHLIGHTING_POST,
    };

    var nextSearcher = new Searcher(options);

    return nextSearcher;
  }

  // search (execute the query) and produce results
  // to the returned future
  function search() {
    /*jslint validthis:true*/
    var self = this;
    var url = self.callUrl;
    self.inError = false;

    var thisSearcher = self;

    var getExplData = function (solrResp) {
      if (Object.hasOwn(solrResp, 'debug') && solrResp.debug !== null) {
        var dbg = solrResp.debug;
        if (Object.hasOwn(dbg, 'explain') && dbg.explain !== null) {
          return dbg.explain;
        }
      }
      return {};
    };

    var getOthersExplained = function (solrResp) {
      if (Object.hasOwn(solrResp, 'debug') && solrResp.debug !== null) {
        var dbg = solrResp.debug;
        if (Object.hasOwn(dbg, 'explainOther') && dbg.explainOther !== null) {
          return dbg.explainOther;
        }
      }
      return {};
    };

    // Return information about how long a query took to run.
    // each event has nested tree like {name: 'blah', duration:43, events:[{name: 'foo', duration:20},{name: 'bar', duration:23}]
    var getTimingDetails = function (solrResp) {
      var queryTimingData = {};
      if (Object.hasOwn(solrResp, 'debug') && solrResp.debug !== null) {
        if (Object.hasOwn(solrResp.debug, 'timing') && solrResp.debug.timing !== null) {
          var timing = solrResp.debug.timing;
          queryTimingData = {
            name: 'timing',
            duration: timing.time,
            events: [],
          };
          if (Object.hasOwn(timing, 'prepare') && timing.prepare !== null) {
            let keys = Object.keys(timing.prepare);
            if (Object.hasOwn(timing.prepare, 'time')) {
              keys.splice(keys.indexOf('time'), 1);
            }
            utilsSvc.safeForEach(keys, function (key) {
              var event = {
                name: 'prepare_' + key,
                duration: timing.prepare[key].time,
              };
              queryTimingData.events.push(event);
            });
          }

          if (Object.hasOwn(timing, 'process') && timing.process !== null) {
            let keys = Object.keys(timing.process);
            if (Object.hasOwn(timing.process, 'time')) {
              keys.splice(keys.indexOf('time'), 1);
            }
            utilsSvc.safeForEach(keys, function (key) {
              var event = {
                name: 'process_' + key,
                duration: timing.process[key].time,
              };
              queryTimingData.events.push(event);
            });
          }
        }
      }
      return queryTimingData;
    };

    var getQueryDetails = function (solrResp) {
      var queryDetails = {};
      if (Object.hasOwn(solrResp, 'responseHeader') && solrResp.responseHeader !== null) {
        var responseHeader = solrResp.responseHeader;
        if (Object.hasOwn(responseHeader, 'params') && responseHeader.params !== null) {
          queryDetails = solrResp.responseHeader.params;
        }
      }
      return queryDetails;
    };

    var getQueryParsingData = function (solrResp) {
      var queryParsingData = {};
      if (Object.hasOwn(solrResp, 'debug') && solrResp.debug !== null) {
        var keysToIgnore = ['track', 'timing', 'explain', 'explainOther'];
        var dbg = solrResp.debug;
        var keys = Object.keys(dbg);
        utilsSvc.safeForEach(keysToIgnore, function (keyToIgnore) {
          if (Object.hasOwn(dbg, keyToIgnore)) {
            keys.splice(keys.indexOf(keyToIgnore), 1);
          }
        });

        utilsSvc.safeForEach(keys, function (key) {
          queryParsingData[key] = dbg[key];
        });
      }

      if (Object.hasOwn(solrResp, 'querqy.infoLog') && solrResp['querqy.infoLog'] !== null) {
        queryParsingData['querqy.infoLog'] = solrResp['querqy.infoLog'];
      }
      // Bracket keys match Solr response field names (e.g. querqy_*).
      if (
        Object.hasOwn(solrResp, 'querqy_decorations') &&
        solrResp['querqy_decorations'] !== null
      ) {
        queryParsingData['querqy_decorations'] = solrResp['querqy_decorations'];
      }
      return queryParsingData;
    };

    var getHlData = function (solrResp) {
      if (Object.hasOwn(solrResp, 'highlighting') && solrResp.highlighting !== null) {
        return solrResp.highlighting;
      }
      return {};
    };

    var apiMethod = defaultSolrConfig.apiMethod; // Solr defaults to JSONP
    if (self.config && self.config.apiMethod) {
      apiMethod = self.config.apiMethod;
    }

    let uri = esUrlSvc.parseUrl(url);
    var headers = esUrlSvc.getHeaders(uri, self.config.customHeaders);
    url = esUrlSvc.stripBasicAuth(url);

    var proxyUrl = self.config.proxyUrl;

    var transport = transportSvc.getTransport({ apiMethod: apiMethod, proxyUrl: proxyUrl });

    activeQueries.count++;
    return transport
      .query(url, null, headers, transportRequestOpts(self.config))
      .then(
        function success(resp) {
          var solrResp = resp.data;
          activeQueries.count--;

          var explDict = getExplData(solrResp);
          var hlDict = getHlData(solrResp);
          thisSearcher.othersExplained = getOthersExplained(solrResp);
          thisSearcher.parsedQueryDetails = getQueryParsingData(solrResp);
          thisSearcher.queryDetails = getQueryDetails(solrResp);
          thisSearcher.timingDetails = getTimingDetails(solrResp);

          var parseSolrDoc = function (solrDoc, groupedBy, group) {
            var options = {
              groupedBy: groupedBy,
              group: group,
              fieldList: self.fieldList,
              hlFieldList: self.hlFieldList,
              url: self.url,
              explDict: explDict,
              hlDict: hlDict,
              highlightingPre: self.HIGHLIGHTING_PRE,
              highlightingPost: self.HIGHLIGHTING_POST,
            };

            return new SolrDocFactory(solrDoc, options);
          };

          if (Object.hasOwn(solrResp, 'response') && solrResp.response !== null) {
            utilsSvc.safeForEach(solrResp.response.docs, function (solrDoc) {
              var doc = parseSolrDoc(solrDoc);
              thisSearcher.numFound = solrResp.response.numFound;
              thisSearcher.docs.push(doc);
            });
          } else if (Object.hasOwn(solrResp, 'grouped') && solrResp.grouped !== null) {
            utilsSvc.safeForEach(solrResp.grouped, function (groupedBy, groupedByName) {
              thisSearcher.numFound = groupedBy.matches;
              // add docs for a top level group
              //console.log(groupedBy.doclist.docs);
              if (Object.hasOwn(groupedBy, 'doclist') && groupedBy.doclist !== null) {
                utilsSvc.safeForEach(groupedBy.doclist.docs, function (solrDoc) {
                  var doc = parseSolrDoc(solrDoc, groupedByName, solrDoc[groupedByName]);
                  thisSearcher.docs.push(doc);
                  thisSearcher.addDocToGroup(groupedByName, solrDoc[groupedByName], doc);
                });
              }

              // add docs for Field Collapsing results
              utilsSvc.safeForEach(groupedBy.groups, function (groupResp) {
                var groupValue = groupResp.groupValue;
                utilsSvc.safeForEach(groupResp.doclist.docs, function (solrDoc) {
                  var doc = parseSolrDoc(solrDoc, groupedByName, groupValue);
                  thisSearcher.docs.push(doc);
                  thisSearcher.addDocToGroup(groupedByName, groupValue, doc);
                });
              });
            });
          }
        },
        function error(msg) {
          activeQueries.count--;
          if (isAbortError(msg)) {
            throw msg;
          }
          thisSearcher.inError = true;
          msg.searchError =
            'Error with Solr query or server. Contact Solr directly to inspect the error';
          throw msg;
        },
      )
      .catch(function (response) {
        console.debug('Failed to run search');
        throw response;
      });
  } // end of search()

  function explainOther(otherQuery, fieldSpec, defType) {
    /*jslint validthis:true*/
    var self = this;

    var originalArgs = self.args;
    self.args = utilsSvc.deepClone(self.args);
    self.args.explainOther = [otherQuery];
    solrSearcherPreprocessorSvc.prepare(self);

    // First query carries out the explainOther
    return self
      .search()
      .then(function () {
        var start = 0;
        var rows = self.config.numberOfRows;

        if (self.args.rows !== undefined && self.args.rows !== null) {
          rows = self.args.rows;
        }

        if (self.args.start !== undefined && self.args.start !== null) {
          start = self.args.start;
        }
        var solrParams = {
          qf: [fieldSpec.title + ' ' + fieldSpec.id],
          rows: [rows],
          start: [start],
          q: [otherQuery],
        };

        if (defType) {
          solrParams.defType = defType;
        }

        var otherConfig = {
          numberOfRows: self.config.numberOfRows,
        };
        if (self.config && self.config.signal !== undefined) {
          otherConfig.signal = self.config.signal;
        }
        var otherSearcherOptions = {
          fieldList: self.fieldList,
          hlFieldList: self.hlFieldList,
          url: self.url,
          args: solrParams,
          queryText: otherQuery,
          config: otherConfig,
          type: self.type,
          HIGHLIGHTING_PRE: self.HIGHLIGHTING_PRE,
          HIGHLIGHTING_POST: self.HIGHLIGHTING_POST,
        };

        var otherSearcher = new Searcher(otherSearcherOptions);

        // Second query fetches metadata for the explained documents
        return otherSearcher.search().then(function () {
          self.numFound = otherSearcher.numFound;
          self.docs = otherSearcher.docs;
          self.args = originalArgs;
        });
      })
      .catch(function (response) {
        self.args = originalArgs;
        console.debug('Failed to run explainOther');
        throw response;
      });
  }

  // Return factory object
  return Searcher;
}


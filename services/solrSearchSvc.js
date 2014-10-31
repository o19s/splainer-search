'use strict';

// Executes a solr search and returns
// a set of solr documents
angular.module('o19s.splainer-search')
  .service('solrSearchSvc', function solrSearchSvc($http, solrUrlSvc) {


    // PRE and POST strings, can't just use HTML
    // because Solr doesn't appear to support escaping 
    // XML/HTML tags in the content. So we do this stupid thing 
    this.HIGHLIGHTING_PRE = 'aouaoeuCRAZY_STRING!8_______';
    this.HIGHLIGHTING_POST = '62362iueaiCRAZY_POST_STRING!_______';
    var svc = this;

    var activeQueries = 0;

    // a URL to access a the specified docId 
    var buildTokensUrl = function(fieldList, solrUrl, idField, docId) {
      var escId = encodeURIComponent(solrUrlSvc.escapeUserQuery(docId));
      var tokensArgs = {
        'indent': ['true'],
        'wt': ['xml'],
        //'q': [idField + ':' + escId],
        'facet': ['true'],
        'facet.field': [],
        'facet.mincount': ['1'],
      };
      if (fieldList !== '*') {
        angular.forEach(fieldList, function(fieldName) {
          if (fieldName !== 'score') {
            tokensArgs['facet.field'].push(fieldName);
          }
        });
      }
      return solrUrlSvc.buildUrl(solrUrl, tokensArgs) + '&q=' + idField + ':'  + escId;
    };

    // the full URL we'll use to call Solr
    var buildCallUrl = function(fieldList, solrUrl, solrArgs, queryText, config) {
      solrArgs.fl = (fieldList === '*') ? '*' : [fieldList.join(' ')];
      solrArgs.wt = ['json'];
      if (config.debug) {
        solrArgs.debug = ['true'];
        solrArgs['debug.explain.structured'] = ['true'];
      }
      if (config.highlight) {
        solrArgs.hl = ['true'];
        solrArgs['hl.fl'] = solrArgs.fl;
        solrArgs['hl.simple.pre'] = [svc.HIGHLIGHTING_PRE];
        solrArgs['hl.simple.post'] = [svc.HIGHLIGHTING_POST];
      }
      var baseUrl = solrUrlSvc.buildUrl(solrUrl, solrArgs);
      baseUrl = baseUrl.replace(/#\$query##/g, encodeURIComponent(queryText));
      return baseUrl;
    };
    
    var withoutUnsupported = function(argsToUse, dontSanitize) {
      var argsRemoved = angular.copy(argsToUse);
      if (dontSanitize !== true) {
        solrUrlSvc.removeUnsupported(argsRemoved);
      }
      return argsRemoved;
    };

    var defaultConfig = {
      sanitize: true,
      highlight: true,
      debug: true
    };

    this.configFromDefault = function() {
      return angular.copy(defaultConfig);
    };


    var SolrSearcher = function(fieldList, solrUrl, solrArgs, queryText, config) {
      if (config === undefined) {
        config = defaultConfig;
      }
      this.callUrl = this.linkUrl = '';
      this.callUrl = buildCallUrl(fieldList, solrUrl, withoutUnsupported(solrArgs, !config.sanitize), queryText, config);
      this.linkUrl = this.callUrl.replace('wt=json', 'wt=xml');
      this.linkUrl = this.linkUrl + '&indent=true&echoParams=all';
      this.docs = [];
      this.grouped = {};
      this.numFound = 0;
      this.inError = false;

      this.addDocToGroup = function(groupedBy, group, solrDoc) {
        if (!this.grouped.hasOwnProperty(groupedBy)) {
          this.grouped[groupedBy] = [];
        }
        var found = null;
        angular.forEach(this.grouped[groupedBy], function(groupedDocs) {
          if (groupedDocs.value === group && !found) {
            found = groupedDocs;
          }
        });
        if (!found) {
          found = {docs:[], value:group};
          this.grouped[groupedBy].push(found);
        }
        found.docs.push(solrDoc);
      };

      // return a new searcher that will give you
      // the next page upon search(). To get the subsequent
      // page, call pager on that searcher ad infinidum
      this.pager = function() {
        var start = 0;
        var nextArgs = angular.copy(solrArgs);
        if (nextArgs.hasOwnProperty('start')) {
          start = parseInt(nextArgs.start) + 10;
          if (start >= this.numFound) {
            return null; // no more results
          }
        } else {
          start = 10;
        }
        var remaining = this.numFound - start;
        nextArgs.rows = ['' + Math.min(10, remaining)];
        nextArgs.start = ['' + start];
        var pageConfig = defaultConfig;
        pageConfig.sanitize = false;
        return new SolrSearcher(fieldList, solrUrl, nextArgs, queryText, pageConfig);
      };

      // search (execute the query) and produce results
      // to the returned future
      this.search = function() {
        var url = this.callUrl + '&json.wrf=JSON_CALLBACK';
        this.inError = false;
        
        var promise = Promise.create(this.search);
        var that = this;

        var getExplData = function(data) {
          if (data.hasOwnProperty('debug')) {
            var dbg = data.debug;
            if (dbg.hasOwnProperty('explain')) {
              return dbg.explain;
            }
          }
          return {};
        };

        var getHlData = function(data) {
          if (data.hasOwnProperty('highlighting')) {
            return data.highlighting;
          }
          return {};
        };

        activeQueries++;
        $http.jsonp(url).success(function(data) {
          activeQueries--;
          var explDict = getExplData(data);
          var hlDict = getHlData(data);
         
          var parseSolrDoc = function(solrDoc, groupedBy, group) {
            // annotate the doc with several methods
            var source = angular.copy(solrDoc);
            if (groupedBy === undefined) {
              groupedBy = null;
            }
            if (group === undefined) {
              group = null;
            }

            solrDoc.groupedBy = function() {
              return groupedBy;
            };

            solrDoc.group = function() {
              return group;
            };

            solrDoc.source = function() {
              return source;
            };

            solrDoc.url = function(idField, docId) {
              return buildTokensUrl(fieldList, solrUrl, idField, docId);
            };
            solrDoc.explain = function(docId) {
              if (explDict.hasOwnProperty(docId)) {
                return explDict[docId];
              } else {
                return null;
              }
            };

            solrDoc.snippet = function(docId, fieldName) {
              if (hlDict.hasOwnProperty(docId)) {
                var docHls = hlDict[docId];
                if (docHls.hasOwnProperty(fieldName)) {
                  return docHls[fieldName];
                }
              }
              return null;
            };

            solrDoc.highlight = function(docId, fieldName, preText, postText) {
              var fieldValue = this.snippet(docId, fieldName);
              if (fieldValue) {
                var esc = escapeHtml(fieldValue);
                
                var preRegex = new RegExp(svc.HIGHLIGHTING_PRE, 'g');
                var hlPre = esc.replace(preRegex, preText);
                var postRegex = new RegExp(svc.HIGHLIGHTING_POST, 'g');
                return hlPre.replace(postRegex, postText);
              } else {
                return null;
              }
            };
          };


          if (data.hasOwnProperty('response')) {
            angular.forEach(data.response.docs, function(solrDoc) {
              parseSolrDoc(solrDoc); 
              that.numFound = data.response.numFound;
              that.docs.push(solrDoc);
            });
          } else if (data.hasOwnProperty('grouped')) {
            angular.forEach(data.grouped, function(groupedBy, groupedByName) {
              that.numFound = groupedBy.matches;
              angular.forEach(groupedBy.groups, function(groupResp) {
                var groupValue = groupResp.groupValue;
                angular.forEach(groupResp.doclist.docs, function(solrDoc) {
                  parseSolrDoc(solrDoc, groupedByName, groupValue);
                  that.docs.push(solrDoc);
                  that.addDocToGroup(groupedByName, groupValue, solrDoc);
                });
              });
            });
          }
          
          promise.complete();
        }).error(function() {
          activeQueries--;
          that.inError = true;
          promise.complete();
        });
        return promise;

      };
    };

    this.createSearcherFromSettings = function(settings, queryText) {
      return new SolrSearcher(settings.createFieldSpec().fieldList(), settings.solrUrl,
                              settings.selectedTry.solrArgs, queryText);
    };

    this.createSearcher = function (fieldList, solrUrl, solrArgs, queryText, config) {
      return new SolrSearcher(fieldList, solrUrl, solrArgs, queryText, config);
    };

    this.activeQueries = function() {
      return activeQueries;
    };
   
    var entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '\"': '&quot;',
      '\'': '&#39;',
      '/': '&#x2F;'
    };

    var escapeHtml = function(string) {
      return String(string).replace(/[&<>"'\/]/g, function (s) {
        return entityMap[s];
      });
    };
  });

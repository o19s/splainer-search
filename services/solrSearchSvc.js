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
      angular.forEach(fieldList, function(fieldName) {
        if (fieldName !== 'score') {
          tokensArgs['facet.field'].push(fieldName);
        }
      });
      return solrUrlSvc.buildUrl(solrUrl, tokensArgs) + '&q=' + idField + ':'  + escId;
    };

    // the full URL we'll use to call Solr
    var buildCallUrl = function(fieldList, solrUrl, solrArgs, queryText) {
      solrArgs.fl = [fieldList.join(' ')];
      solrArgs.wt = ['json'];
      solrArgs.debug = ['true'];
      solrArgs['debug.explain.structured'] = ['true'];
      solrArgs.hl = ['true'];
      solrArgs['hl.simple.pre'] = [svc.HIGHLIGHTING_PRE];
      solrArgs['hl.simple.post'] = [svc.HIGHLIGHTING_POST];
      var baseUrl = solrUrlSvc.buildUrl(solrUrl, solrArgs);
      baseUrl = baseUrl.replace(/#\$query##/g, encodeURIComponent(queryText));
      return baseUrl;
    };

    var SolrSearcher = function(fieldList, solrUrl, solrArgs, queryText) {
      this.callUrl = this.linkUrl = '';
      this.callUrl = buildCallUrl(fieldList, solrUrl, angular.copy(solrArgs), queryText);
      this.linkUrl = this.callUrl.replace('wt=json', 'wt=xml');
      this.linkUrl = this.linkUrl + '&indent=true&echoParams=all';
      this.docs = [];
      this.numFound = 0;
      this.inError = false;

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
        return new SolrSearcher(fieldList, solrUrl, nextArgs, queryText);
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
          that.numFound = data.response.numFound;
          var explDict = getExplData(data);
          var hlDict = getHlData(data);
          angular.forEach(data.response.docs, function(solrDoc) {
            
            // annotate the doc with several methods
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
            solrDoc.highlight = function(docId, fieldName) {
              if (hlDict.hasOwnProperty(docId)) {
                var docHls = hlDict[docId];
                if (docHls.hasOwnProperty(fieldName)) {
                  return docHls[fieldName];
                }
              }
              return null;
            };
            that.docs.push(solrDoc);
          });
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

    this.createSearcher = function (fieldList, solrUrl, solrArgs, queryText) {
      return new SolrSearcher(fieldList, solrUrl, solrArgs, queryText);
    };

    this.activeQueries = function() {
      return activeQueries;
    };
   
    this.removeUnsupportedArgs = function(argsToUse) {
        delete argsToUse.fl;
        delete argsToUse.wt;
        delete argsToUse.rows;
        delete argsToUse.debug;
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

    this.markedUpFieldValue = function(fieldValue, pre, post) {
      var esc = escapeHtml(fieldValue);
      
      var preRegex = new RegExp(svc.HIGHLIGHTING_PRE, 'g');
      var hlPre = esc.replace(preRegex, pre);
      var postRegex = new RegExp(svc.HIGHLIGHTING_POST, 'g');
      return hlPre.replace(postRegex, post);
    };
  });

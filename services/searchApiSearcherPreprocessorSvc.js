'use strict';

angular.module('o19s.splainer-search')
  .service('searchApiSearcherPreprocessorSvc', [
    'queryTemplateSvc',
    function searchApiSearcherPreprocessorSvc(queryTemplateSvc) {
      var self      = this;
      self.prepare  = prepare;
      
      var replaceQuery = function(qOption, args, queryText) {
        // Allows full override of query if a JSON friendly format is sent in
        if (queryText instanceof Object) {
          return queryText;
        } else {
          if (queryText) {
            queryText = queryText.replace(/\\/g, '\\\\');
            queryText = queryText.replace(/"/g, '\\\"');
          }
          return queryTemplateSvc.hydrate(args, queryText, {qOption: qOption, encodeURI: false, defaultKw: '\\"\\"'});
        }
      };
      
      var prepareGetRequest = function (searcher) {
        var queryDsl        = replaceQuery(searcher.config.qOption, searcher.args, searcher.queryText);
        var paramsAsStrings = [];
        
        if (angular.isObject(queryDsl)){
          angular.forEach(queryDsl, function(value, key) {
            paramsAsStrings.push(key + '=' + value);
          });
        }
        else {
          var queryDSLAsQuerySTring = queryDsl.toString();
          paramsAsStrings.push(queryDSLAsQuerySTring);
        }
        var finalUrl = searcher.url;
        var hasQuery = finalUrl.indexOf('?') !== -1;
        var endsWithQuestion = finalUrl.substring(finalUrl.length - 1) === '?';
        var separator = '?' ;

        if (hasQuery) {
          separator = endsWithQuestion ? '' : '&';
        }

        finalUrl += separator + paramsAsStrings.join('&');
        
        searcher.url = finalUrl;
      };
      
      var preparePostRequest = function (searcher) {
       
        var queryDsl        = replaceQuery(searcher.config.qOption, searcher.args, searcher.queryText);

        searcher.queryDsl   = queryDsl;
      };      
      
      function prepare (searcher) {
        if ( searcher.config.apiMethod === 'POST') {
          preparePostRequest(searcher);
        } else if ( searcher.config.apiMethod === 'GET') {
          prepareGetRequest(searcher);
        }
      }
      
      
    }
  ]);

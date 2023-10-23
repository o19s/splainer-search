'use strict';

angular.module('o19s.splainer-search')
  .service('searchApiSearcherPreprocessorSvc', [
    'queryTemplateSvc',
    function searchApiSearcherPreprocessorSvc(queryTemplateSvc) {
      var self      = this;
      self.prepare  = prepare;


      function prepare (searcher) {
        console.log("HI from prepare")
        if ( searcher.config.apiMethod === 'POST') {
          preparePostRequest(searcher);
        } else if ( searcher.config.apiMethod === 'GET') {
          prepareGetRequest(searcher);
        }
      };
      
      var prepareGetRequest = function (searcher) {
        console.log("I am in prepareGetRequest")
        console.log("args is" + searcher.args)
        console.log(searcher.args)
        console.log("querytext is " + searcher.queryText)
        var queryDsl        = replaceQuery(searcher.args, searcher.queryText);
        console.log("Here is queryDSL")
        console.log(queryDsl)
        console.log("Here is tostring version")
        console.log(queryDsl.toString())
        
        console.log(JSON.stringify(queryDsl))
        var paramsAsStrings = [];
        
        if (angular.isObject(queryDsl)){
          angular.forEach(queryDsl, function(value, key) {
            console.log("got key " + key + ", with value " + value)
            paramsAsStrings.push(key + '=' + value);
          });
        }
        else {
          var queryDSLAsQuerySTring = queryDsl.toString();
          paramsAsStrings.push(queryDSLAsQuerySTring);
        }
        var finalUrl = searcher.url;

        if (finalUrl.substring(finalUrl.length - 1) === '?') {
          finalUrl += paramsAsStrings.join('&');
        } else {
          finalUrl += '?' + paramsAsStrings.join('&');
        }
        
        searcher.url = finalUrl
      };
      
      var preparePostRequest = function (searcher) {
       
        var queryDsl        = replaceQuery(searcher.args, searcher.queryText);

        searcher.queryDsl   = queryDsl;
      };
      
      var replaceQuery = function(args, queryText) {
        // Allows full override of query if a JSON friendly format is sent in
        if (queryText instanceof Object) {
          return queryText;
        } else {
          if (queryText) {
            queryText = queryText.replace(/\\/g, '\\\\');
            queryText = queryText.replace(/"/g, '\\\"');
          }

          var replaced  = angular.toJson(args, true);

          replaced      = queryTemplateSvc.hydrate(replaced, queryText, {encodeURI: false, defaultKw: '\\"\\"'});
          replaced      = angular.fromJson(replaced);

          return replaced;
        }
      };
      
      
    }
  ]);

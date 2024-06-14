'use strict';

angular.module('o19s.splainer-search')
  .service('a2SearcherPreprocessorSvc', [
    'queryTemplateSvc',
    function a2SearcherPreprocessorSvc(queryTemplateSvc) {
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

      var preparePostRequest = function (searcher) {

        var queryDsl        = replaceQuery(searcher.config.qOption, searcher.args, searcher.queryText);

        searcher.queryDsl   = queryDsl;
      };

      function prepare (searcher) {
        if ( searcher.config.apiMethod === 'POST') {
          preparePostRequest(searcher);
        }
      }
    }
  ]);

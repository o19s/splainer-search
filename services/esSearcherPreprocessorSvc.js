'use strict';

angular.module('o19s.splainer-search')
  .service('esSearcherPreprocessorSvc', function esSearcherPreprocessorSvc() {
    var self      = this;
    self.prepare  = prepare;

    var replaceQuery = function(args, queryText) {
      if (queryText) {
        queryText = queryText.replace(/\\/g, '\\\\');
        queryText = queryText.replace(/"/g, '\\\"');
      }

      var replaced  = angular.toJson(args, true);
      replaced      = replaced.replace(/#\$query##/g, queryText);
      replaced      = angular.fromJson(replaced);

      return replaced;
    };

    function prepare (searcher) {
      var pagerArgs       = angular.copy(searcher.args.pager);
      searcher.pagerArgs  = pagerArgs;
      delete searcher.args.pager;

      var queryDsl        = replaceQuery(searcher.args, searcher.queryText);

      if ( angular.isDefined(searcher.fieldList) && searcher.fieldList !== null ) {
        queryDsl.fields   = searcher.fieldList;
      }

      queryDsl.explain    = true;

      searcher.queryDsl   = queryDsl;
    }
  });

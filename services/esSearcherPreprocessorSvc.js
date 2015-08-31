'use strict';

angular.module('o19s.splainer-search')
  .service('esSearcherPreprocessorSvc', function esSearcherPreprocessorSvc() {
    var self      = this;
    self.prepare  = prepare;

    var replaceQuery = function(args, queryText) {
      var replaced = angular.toJson(args, true);
      replaced = replaced.replace(/#\$query##/g, queryText);
      replaced = angular.fromJson(replaced);

      return replaced;
    };

    function prepare (searcher) {
      var queryDsl = replaceQuery(searcher.args, searcher.queryText);
      queryDsl.fields   = searcher.fieldList;
      queryDsl.explain  = true;

      searcher.queryDsl = queryDsl;
    }
  });

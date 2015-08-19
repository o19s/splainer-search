'use strict';

angular.module('o19s.splainer-search')
  .service('esSearcherPreprocessorSvc', function esSearcherPreprocessorSvc() {
    var self      = this;
    self.prepare  = prepare;

    var replaceQuery = function(args, queryText) {
      var replaced = {};
      angular.forEach(args, function(value, key) {
        if (typeof(value) === 'object') {
          replaced[key] = replaceQuery(value, queryText);
        } else if (typeof(value) === 'string') {
          replaced[key] = value.replace(/#\$query##/g, queryText);
        } else {
          replaced[key] = value;
        }
      });
      return replaced;
    };

    function prepare (searcher) {
      var queryDsl = replaceQuery(searcher.args, searcher.queryText);
      queryDsl.fields   = searcher.fieldList;
      queryDsl.explain  = true;

      searcher.queryDsl = queryDsl;
    }
  });

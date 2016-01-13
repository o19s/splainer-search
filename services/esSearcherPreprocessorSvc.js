'use strict';

angular.module('o19s.splainer-search')
  .service('esSearcherPreprocessorSvc', [
    'queryTemplateSvc',
    function esSearcherPreprocessorSvc(queryTemplateSvc) {
      var self      = this;
      self.prepare  = prepare;

      var replaceQuery = function(args, queryText) {
        if (queryText) {
          queryText = queryText.replace(/\\/g, '\\\\');
          queryText = queryText.replace(/"/g, '\\\"');
        }

        var replaced  = angular.toJson(args, true);

        replaced      = queryTemplateSvc.hydrate(replaced, queryText, {encodeURI: false, defaultKw: '\\"\\"'});
        replaced      = angular.fromJson(replaced);

        return replaced;
      };

      var prepareHighlighting = function (args, fields) {
        if ( angular.isDefined(fields) && fields.hasOwnProperty('fields') ) {
          fields = fields.fields;
        }

        if ( angular.isDefined(fields) && fields.length > 0 ) {
          var hl = { fields: {} };

          angular.forEach(fields, function(fieldName) {
            hl.fields[fieldName] = {};
          });

          return hl;
        } else {
          return {
            fields: {
              _all: {}
            }
          };
        }
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

        if ( !queryDsl.hasOwnProperty('highlight') ) {
          queryDsl.highlight = prepareHighlighting(searcher.args, queryDsl.fields);
        }

        searcher.queryDsl   = queryDsl;
      }
    }
  ]);

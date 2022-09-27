'use strict';

angular.module('o19s.splainer-search')
  .service('esCloudSearcherPreprocessorSvc', [
    'queryTemplateSvc',
    'defaultESConfig',
    function esCloudSearcherPreprocessorSvc(queryTemplateSvc, defaultESConfig) {
      var self = this;

      // Attributes
      // field name since ES 5.0
      self.fieldsParamNames = [ '_source'];

      // Functions
      self.prepare  = prepare;

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

      var prepareHighlighting = function (args, fields) {
        if ( angular.isDefined(fields) && fields !== null ) {
          if ( fields.hasOwnProperty('fields') ) {
            fields = fields.fields;
          }

          if ( fields.length > 0 ) {
            var hl = { fields: {} };

            angular.forEach(fields, function(fieldName) {
              /*
               * ES doesn't like highlighting on _id if the query has been filtered on _id using a terms query.
               */
              if (fieldName === '_id') {
                return;
              }

              hl.fields[fieldName] = { };
            });

            return hl;
          }
        }

        return {
          fields: {
            _all: {}
          }
        };
      };

      var preparePostRequest = function (searcher) {
        var pagerArgs = angular.copy(searcher.args.pager);
        if ( angular.isUndefined(pagerArgs) || pagerArgs === null ) {
          pagerArgs = {};
        }

        var defaultPagerArgs = {
          from: 0,
          size: searcher.config.numberOfRows,
        };

        searcher.pagerArgs  = angular.merge({}, defaultPagerArgs, pagerArgs);
        delete searcher.args.pager;

        var queryDsl        = replaceQuery(searcher.args, searcher.queryText);
        queryDsl.explain    = true;
        queryDsl.profile    = true;

        if ( angular.isDefined(searcher.fieldList) && searcher.fieldList !== null ) {
          angular.forEach(self.fieldsParamNames, function(name) {
            queryDsl[name] = searcher.fieldList;
          });
        }

        if ( !queryDsl.hasOwnProperty('highlight') ) {
          queryDsl.highlight = prepareHighlighting(searcher.args, queryDsl[self.fieldsParamNames[0]]);
        }

        searcher.queryDsl   = queryDsl;
        searcher.apiKey = searcher.apiKey;
      };

      var prepareGetRequest = function (searcher) {
        searcher.url = searcher.url + '?q=' + searcher.queryText;
        searcher.apiKey = searcher.apiKey;
        var pagerArgs = angular.copy(searcher.args.pager);
        delete searcher.args.pager;

        if ( angular.isDefined(pagerArgs) && pagerArgs !== null ) {
          searcher.url += '&from=' + pagerArgs.from;
          searcher.url += '&size=' + pagerArgs.size;
        } else {
          searcher.url += '&size=' + searcher.config.numberOfRows;
        }
      };

      function prepare (searcher) {
        if (searcher.config === undefined) {
          searcher.config = defaultESConfig;
        } else {
          // make sure config params that weren't passed through are set from
          // the default config object.
          searcher.config = angular.merge({}, defaultESConfig, searcher.config);
        }

        if ( searcher.config.apiMethod === 'POST') {
          preparePostRequest(searcher);
        } else if ( searcher.config.apiMethod === 'GET') {
          prepareGetRequest(searcher);
        }
      }
    }
  ]);

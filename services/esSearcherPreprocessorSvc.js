'use strict';

angular.module('o19s.splainer-search')
  .service('esSearcherPreprocessorSvc', [
    'queryTemplateSvc',
    'defaultESConfig',
    function esSearcherPreprocessorSvc(queryTemplateSvc, defaultESConfig) {
      var self = this;

      // Attributes
      self.fieldsParamName = 'stored_fields'; // field name since ES 5.0

      // Functions
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
        if ( angular.isDefined(fields) && fields !== null && fields.hasOwnProperty('fields') ) {
          fields = fields.fields;
        }

        if ( angular.isDefined(fields) && fields !== null && fields.length > 0 ) {
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

        if ( angular.isDefined(searcher.fieldList) && searcher.fieldList !== null ) {
          queryDsl[self.fieldsParamName] = searcher.fieldList;
        }

        queryDsl.explain    = true;

        if ( !queryDsl.hasOwnProperty('highlight') ) {
          queryDsl.highlight = prepareHighlighting(searcher.args, queryDsl[self.fieldsParamName]);
        }

        searcher.queryDsl   = queryDsl;
      };

      var prepareGetRequest = function (searcher) {
        searcher.url = searcher.url + '?q=' + searcher.queryText;

        var pagerArgs = angular.copy(searcher.args.pager);
        delete searcher.args.pager;

        if ( angular.isDefined(pagerArgs) && pagerArgs !== null ) {
          searcher.url += '&from=' + pagerArgs.from;
          searcher.url += '&size=' + pagerArgs.size;
        } else {
          searcher.url += '&size=' + searcher.config.numberOfRows;
        }
      };

      var setFieldsParamName = function(searcher) {
        if ( 5 <= searcher.majorVersion() ) {
          self.fieldsParamName = 'stored_fields';
        } else {
          self.fieldsParamName = 'fields';
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

        setFieldsParamName(searcher);

        if ( searcher.config.apiMethod === 'post') {
          preparePostRequest(searcher);
        } else if ( searcher.config.apiMethod === 'get') {
          prepareGetRequest(searcher);
        }
      }
    }
  ]);

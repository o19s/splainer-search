'use strict';

export function esSearcherPreprocessorSvcConstructor(queryTemplateSvc, defaultESConfig, utilsSvc) {
  var self = this;

  // Attributes
  // field name since ES 5.0
  self.fieldsParamNames = ['_source'];

  // Functions
  self.prepare = prepare;

  var replaceQuery = function (qOption, args, queryText) {
    // Allows full override of query if a JSON friendly format is sent in
    if (queryText instanceof Object) {
      return queryText;
    } else {
      if (queryText) {
        queryText = queryText.replace(/\\/g, '\\\\');
        queryText = queryText.replace(/"/g, '\\' + '"');
      }
      return queryTemplateSvc.hydrate(args, queryText, {
        qOption: qOption,
        encodeURI: false,
        defaultKw: '\\' + '"' + '\\' + '"',
      });
    }
  };

  var prepareHighlighting = function (args, fields) {
    if (fields !== undefined && fields !== null) {
      if (Object.hasOwn(fields, 'fields')) {
        fields = fields.fields;
      }

      if (fields.length > 0) {
        var hl = { fields: {} };

        utilsSvc.safeForEach(fields, function (fieldName) {
          /*
           * ES doesn't like highlighting on _id if the query has been filtered on _id using a terms query.
           */
          if (fieldName === '_id') {
            return;
          }

          hl.fields[fieldName] = {};
        });

        return hl;
      }
    }

    return {
      fields: {
        _all: {},
      },
    };
  };

  var preparePostRequest = function (searcher) {
    var pagerArgs = utilsSvc.deepClone(searcher.args.pager);
    if (pagerArgs === undefined || pagerArgs === null) {
      pagerArgs = {};
    }

    var defaultPagerArgs = {
      from: 0,
      size: searcher.config.numberOfRows,
    };

    searcher.pagerArgs = utilsSvc.deepMerge({}, defaultPagerArgs, pagerArgs);
    delete searcher.args.pager;

    var queryDsl = replaceQuery(searcher.config.qOption, searcher.args, searcher.queryText);
    queryDsl.explain = true;
    queryDsl.profile = true;

    if (searcher.fieldList !== undefined && searcher.fieldList !== null) {
      utilsSvc.safeForEach(self.fieldsParamNames, function (name) {
        queryDsl[name] = searcher.fieldList;
      });
    }

    if (!Object.hasOwn(queryDsl, 'highlight')) {
      queryDsl.highlight = prepareHighlighting(searcher.args, queryDsl[self.fieldsParamNames[0]]);
    }

    searcher.queryDsl = queryDsl;
  };

  var prepareGetRequest = function (searcher) {
    searcher.url = searcher.url + '?q=' + encodeURIComponent(searcher.queryText);

    var pagerArgs = utilsSvc.deepClone(searcher.args.pager);
    delete searcher.args.pager;

    if (pagerArgs !== undefined && pagerArgs !== null) {
      searcher.url += '&from=' + pagerArgs.from;
      searcher.url += '&size=' + pagerArgs.size;
    } else {
      searcher.url += '&size=' + searcher.config.numberOfRows;
    }
  };

  function prepare(searcher) {
    if (searcher.config === undefined) {
      searcher.config = defaultESConfig;
    } else {
      // make sure config params that weren't passed through are set from
      // the default config object.
      searcher.config = utilsSvc.deepMerge({}, defaultESConfig, searcher.config);
    }

    if (searcher.config.apiMethod === 'POST') {
      preparePostRequest(searcher);
    } else if (searcher.config.apiMethod === 'GET') {
      prepareGetRequest(searcher);
    }
  }
}


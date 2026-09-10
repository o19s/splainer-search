'use strict';

export function esSearcherPreprocessorSvcConstructor(
  esUrlSvc,
  queryTemplateSvc,
  defaultESConfig,
  utilsSvc,
) {
  var self = this;

  // Attributes
  // field name since ES 5.0
  self.fieldsParamNames = ['_source'];

  // Functions
  self.prepare = prepare;

  var replaceQuery = function (qOption, args, queryText, escapeQuery) {
    // config.escapeQuery escapes ES/OS query_string/simple_query_string reserved chars (see
    // esUrlSvc.escapeUserQuery) - a caller opt-in, same as Solr's classic mode, since whether a
    // query_string clause is even in play depends on the caller's own query template.
    if (escapeQuery && typeof queryText === 'string') {
      queryText = esUrlSvc.escapeUserQuery(queryText);
    }

    // escapeQuery: false (hydrateSearchQuery's own option, unrelated to the above) - see
    // solrSearcherPreprocessorSvc.js's prepareJsonQueryDslRequest for why: args is a parsed
    // object, JSON.stringify'd wholesale at the transport layer, which already escapes string
    // values correctly - hydrateSearchQuery's own escaping only double-escapes on top of that.
    return queryTemplateSvc.hydrateSearchQuery(qOption, args, queryText, { escapeQuery: false });
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

    var queryDsl = replaceQuery(
      searcher.config.qOption,
      searcher.args,
      searcher.queryText,
      searcher.config.escapeQuery,
    );
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
    // GET's ?q= is always parsed as query_string syntax (unlike POST, where it depends on the
    // caller's own query template), so escaping here is unambiguous - same as Solr classic.
    var queryText =
      searcher.config.escapeQuery && typeof searcher.queryText === 'string'
        ? esUrlSvc.escapeUserQuery(searcher.queryText)
        : searcher.queryText;
    searcher.url = searcher.url + '?q=' + encodeURIComponent(queryText);

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
    utilsSvc.mergeSearcherConfig(searcher, defaultESConfig);

    if (searcher.config.apiMethod === 'POST') {
      preparePostRequest(searcher);
    } else if (searcher.config.apiMethod === 'GET') {
      prepareGetRequest(searcher);
    }
  }
}

'use strict';

export function solrSearcherPreprocessorSvcConstructor(
  solrUrlSvc,
  defaultSolrConfig,
  queryTemplateSvc,
  utilsSvc,
) {
  var self = this;
  self.prepare = prepare;

  var withoutUnsupported = function (argsToUse, sanitize) {
    var argsRemoved = utilsSvc.deepClone(argsToUse);
    if (sanitize === true) {
      solrUrlSvc.removeUnsupported(argsRemoved);
    }
    return argsRemoved;
  };

  // the full URL we'll use to call Solr
  var buildCallUrl = function (searcher) {
    var fieldList = searcher.fieldList;
    var hlFieldList = searcher.hlFieldList || [];
    var url = searcher.url;
    var config = searcher.config;
    var args = withoutUnsupported(searcher.args, config.sanitize);
    var queryText = searcher.queryText;

    args.fl = fieldList === '*' ? '*' : [fieldList.join(' ')];
    args.wt = ['json'];

    if (config.debug) {
      args.debug = ['true'];
      args['debug.explain.structured'] = ['true'];
    }

    if (config.highlight && hlFieldList.length > 0) {
      args.hl = ['true'];
      args['hl.method'] = ['unified']; // work around issues parsing dates and numbers
      args['hl.fl'] = hlFieldList.join(' ');

      args['hl.simple.pre'] = [searcher.HIGHLIGHTING_PRE];
      args['hl.simple.post'] = [searcher.HIGHLIGHTING_POST];
    } else {
      args.hl = ['false'];
    }

    if (config.escapeQuery) {
      console.warn('SUSS_USE_OF_ESCAPING.  Are you sure?');
      queryText = solrUrlSvc.escapeUserQuery(queryText);
    }

    if (!args.rows) {
      args.rows = [config.numberOfRows];
    }

    var baseUrl = solrUrlSvc.buildUrl(url, args);
    baseUrl = queryTemplateSvc.hydrate(baseUrl, queryText, {
      qOption: config.qOption,
      encodeURI: true,
      defaultKw: '""',
    });

    return baseUrl;
  };

  // Solr's JSON Query DSL (https://solr.apache.org/guide/solr/latest/query-guide/json-query-dsl.html) -
  // a JSON POST body submitted to the same endpoint URL, instead of classic q=...&fq=...
  // querystring params. Unlike classic mode, debug/wt/highlight params aren't auto-injected
  // here - Solr expects those embedded in the body itself (e.g. under "params"), so beyond
  // the fields/limit defaults below, the caller's own args JSON is trusted as-is.
  var prepareJsonQueryDslRequest = function (searcher) {
    var fieldList = searcher.fieldList;
    var config = searcher.config;

    var hydratedArgs = queryTemplateSvc.hydrateSearchQuery(
      config.qOption,
      searcher.args,
      searcher.queryText,
    );

    if (!hydratedArgs.fields && fieldList) {
      hydratedArgs.fields = fieldList === '*' ? '*' : fieldList.join(',');
    }

    if (hydratedArgs.limit === undefined) {
      hydratedArgs.limit = config.numberOfRows;
    }

    searcher.queryDsl = hydratedArgs;
    searcher.callUrl = searcher.url;
    searcher.linkUrl = searcher.url;
  };

  function prepare(searcher) {
    utilsSvc.mergeSearcherConfig(searcher, defaultSolrConfig);

    // config.jsonQueryDsl is a required, explicit signal - no shape-based inference - and
    // defaults to false, so every caller that doesn't set it explicitly gets classic behavior.
    if (searcher.config.jsonQueryDsl) {
      prepareJsonQueryDslRequest(searcher);
    } else {
      searcher.callUrl = buildCallUrl(searcher);

      searcher.linkUrl = searcher.callUrl.replace('wt=xml', 'wt=json');
      searcher.linkUrl = searcher.linkUrl + '&indent=true&echoParams=all';
    }
  }
}

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
  // querystring params. wt isn't relevant here (the JSON API always responds JSON), but
  // debug/highlight are the same caller-facing toggles as classic mode, just expressed as
  // JSON body values under "params" (like explainOther() in solrSearcherFactory.js) instead
  // of classic query-string params - see below.
  var prepareJsonQueryDslRequest = function (searcher) {
    var fieldList = searcher.fieldList;
    var hlFieldList = searcher.hlFieldList || [];
    var config = searcher.config;
    var queryText = searcher.queryText;

    // config.escapeQuery escapes Solr query-syntax reserved chars (same as classic mode, via
    // solrUrlSvc.escapeUserQuery) - a caller opt-in, since whether the #$query## placeholder
    // even lands inside a syntax-parsed clause (e.g. edismax "query") depends on the caller's
    // own JSON template.
    if (config.escapeQuery && typeof queryText === 'string') {
      queryText = solrUrlSvc.escapeUserQuery(queryText);
    }

    // escapeQuery: false (hydrateSearchQuery's own option, unrelated to the above) -
    // hydrateSearchQuery's default backslash/quote escaping is a leftover from when args here
    // was a raw JSON string built by text interpolation, so escaping was needed to keep the
    // result parseable. args is a parsed object now: this searcher.queryDsl is JSON.stringify'd
    // wholesale at the transport layer (httpClient.js), which escapes string values correctly
    // on its own - the manual escaping here only double-escapes on top of that (e.g. a literal
    // `"` survives hydration as `\"`, then becomes `\\\"` once JSON.stringify'd, so Solr
    // receives a literal backslash-quote instead of a quote).
    var hydratedArgs = queryTemplateSvc.hydrateSearchQuery(
      config.qOption,
      searcher.args,
      queryText,
      { escapeQuery: false },
    );

    if (!hydratedArgs.fields && fieldList) {
      hydratedArgs.fields = fieldList === '*' ? '*' : fieldList.join(',');
    }

    if (hydratedArgs.limit === undefined) {
      hydratedArgs.limit = config.numberOfRows;
    }

    if (config.debug) {
      hydratedArgs.params = hydratedArgs.params || {};
      hydratedArgs.params.debug = true;
      hydratedArgs.params['debug.explain.structured'] = true;
    }

    if (config.highlight && hlFieldList.length > 0) {
      hydratedArgs.params = hydratedArgs.params || {};
      hydratedArgs.params.hl = true;
      hydratedArgs.params['hl.method'] = 'unified'; // work around issues parsing dates and numbers
      hydratedArgs.params['hl.fl'] = hlFieldList.join(' ');
      hydratedArgs.params['hl.simple.pre'] = searcher.HIGHLIGHTING_PRE;
      hydratedArgs.params['hl.simple.post'] = searcher.HIGHLIGHTING_POST;
    }

    searcher.queryDsl = hydratedArgs;
    searcher.callUrl = searcher.url;

    // A JSON DSL request is a POST body, so callUrl alone (used for the actual request) has
    // nothing to click through to. Solr also accepts the JSON body as a "json" query
    // parameter (https://solr.apache.org/guide/solr/latest/query-guide/json-request-api.html)
    // - equivalent to the POST body - so linkUrl (display-only, e.g. Quepid's "open in Solr"
    // affordance) embeds the query there instead of losing it.
    var linkUrlSeparator = searcher.url.indexOf('?') === -1 ? '?' : '&';
    searcher.linkUrl =
      searcher.url +
      linkUrlSeparator +
      'json=' +
      encodeURIComponent(JSON.stringify(hydratedArgs)) +
      '&indent=true&echoParams=all';

    // Resolved onto the searcher instance, not searcher.config (a shared reference reused
    // across paginated instances - see solrSearcherFactory.js's buildPagerOptions). JSONP and
    // GET can't carry a body at all (httpJsonpTransportFactory.js takes a payload argument and
    // never uses it), so a JSON DSL request has exactly one viable transport regardless of how
    // apiMethod is configured.
    searcher.apiMethod = 'POST';
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

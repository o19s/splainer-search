'use strict';

// Used when config.apiMethod is 'AUTO' and config.maxGetUrlLength isn't set.
var DEFAULT_MAX_GET_URL_LENGTH = 2000;

export function searchApiSearcherPreprocessorSvcConstructor(queryTemplateSvc, utilsSvc) {
  var self = this;
  self.prepare = prepare;

  var replaceQuery = function (qOption, args, queryText) {
    return queryTemplateSvc.hydrateSearchQuery(qOption, args, queryText);
  };

  var buildGetParamsString = function (queryDsl) {
    var paramsAsStrings = [];

    if (typeof queryDsl === 'object' && queryDsl !== null) {
      // queryDsl is a {key: value, ...} map (e.g. from JSON args like {yql: "..."}) - encode
      // each value, since it's caller-supplied content that may contain reserved URL chars.
      utilsSvc.safeForEach(queryDsl, function (value, key) {
        paramsAsStrings.push(key + '=' + encodeURIComponent(value));
      });
    } else {
      // queryDsl is already a fully-formed query string fragment (e.g. Solr-style raw
      // query_params like 'q=foo&fq=bar'), not a single value - the caller owns its
      // formatting/escaping, so it's passed through as-is rather than encoded wholesale.
      paramsAsStrings.push(queryDsl.toString());
    }

    return paramsAsStrings.join('&');
  };

  var appendParamsToUrl = function (url, paramsString) {
    var hasQuery = url.indexOf('?') !== -1;
    var endsWithQuestion = url.substring(url.length - 1) === '?';
    var separator = '?';

    if (hasQuery) {
      separator = endsWithQuestion ? '' : '&';
    }

    return url + separator + paramsString;
  };

  // Solr/ES default their own fixed-name page-size param (rows/size) from
  // config.numberOfRows in their preprocessors - Search API can't hardcode a name since
  // that's whatever the target API/mapper calls it, so the caller names the two params via
  // config.paginationHitsParam/paginationOffsetParam (both left unset is a silent no-op - an
  // engine that doesn't paginate has nothing to default; exactly one set is a config bug and
  // warns). Only fills in what the caller's own args don't already set, so an explicit value
  // in a hand-written query template still wins.
  var applyPaginationDefaults = function (searcher) {
    var hitsParam = searcher.config.paginationHitsParam;
    var offsetParam = searcher.config.paginationOffsetParam;

    if (!hitsParam && !offsetParam) {
      return; // engine doesn't paginate - nothing to default
    }

    if (!hitsParam || !offsetParam) {
      console.warn(
        'paginationHitsParam and paginationOffsetParam must both be configured to default ' +
          'hits/offset - only one was provided, so neither was defaulted.',
      );
      return;
    }

    if (searcher.args[hitsParam] === undefined) {
      searcher.args[hitsParam] = String(searcher.config.numberOfRows);
    }

    if (searcher.args[offsetParam] === undefined) {
      searcher.args[offsetParam] = '0';
    }
  };

  function prepare(searcher) {
    applyPaginationDefaults(searcher);

    var configuredMethod = searcher.config.apiMethod;

    if (configuredMethod !== 'POST' && configuredMethod !== 'GET' && configuredMethod !== 'AUTO') {
      return;
    }

    var queryDsl = replaceQuery(searcher.config.qOption, searcher.args, searcher.queryText);

    // Resolved onto the searcher instance, never written back onto searcher.config: config is
    // a shared reference reused across paginated Searcher instances (see pager() in
    // searchApiSearcherFactory.js), so mutating it here would leak one page's AUTO decision
    // onto every other page regardless of that page's own query length.
    if (configuredMethod === 'POST') {
      searcher.apiMethod = 'POST';
      searcher.queryDsl = queryDsl;
      return;
    }

    // GET and AUTO both need the candidate GET URL - AUTO to measure it, GET to use it
    // outright - so it's built once here and reused, instead of once to measure and again
    // to apply.
    var getUrl = appendParamsToUrl(searcher.url, buildGetParamsString(queryDsl));

    if (configuredMethod === 'AUTO') {
      var maxGetUrlLength = searcher.config.maxGetUrlLength || DEFAULT_MAX_GET_URL_LENGTH;
      searcher.apiMethod = getUrl.length <= maxGetUrlLength ? 'GET' : 'POST';
    } else {
      searcher.apiMethod = 'GET';
    }

    if (searcher.apiMethod === 'POST') {
      searcher.queryDsl = queryDsl;
    } else {
      searcher.url = getUrl;
    }
  }
}

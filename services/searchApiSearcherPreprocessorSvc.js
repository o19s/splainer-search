'use strict';

export function searchApiSearcherPreprocessorSvcConstructor(queryTemplateSvc, utilsSvc) {
  var self = this;
  self.prepare = prepare;

  var replaceQuery = function (qOption, args, queryText) {
    return queryTemplateSvc.hydrateSearchQuery(qOption, args, queryText);
  };

  var prepareGetRequest = function (searcher) {
    var queryDsl = replaceQuery(searcher.config.qOption, searcher.args, searcher.queryText);
    var paramsAsStrings = [];

    if (typeof queryDsl === 'object' && queryDsl !== null) {
      utilsSvc.safeForEach(queryDsl, function (value, key) {
        paramsAsStrings.push(key + '=' + value);
      });
    } else {
      var queryDslAsQueryString = queryDsl.toString();
      paramsAsStrings.push(queryDslAsQueryString);
    }
    var finalUrl = searcher.url;
    var hasQuery = finalUrl.indexOf('?') !== -1;
    var endsWithQuestion = finalUrl.substring(finalUrl.length - 1) === '?';
    var separator = '?';

    if (hasQuery) {
      separator = endsWithQuestion ? '' : '&';
    }

    finalUrl += separator + paramsAsStrings.join('&');

    searcher.url = finalUrl;
  };

  var preparePostRequest = function (searcher) {
    var queryDsl = replaceQuery(searcher.config.qOption, searcher.args, searcher.queryText);

    searcher.queryDsl = queryDsl;
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

    if (searcher.config.apiMethod === 'POST') {
      preparePostRequest(searcher);
    } else if (searcher.config.apiMethod === 'GET') {
      prepareGetRequest(searcher);
    }
  }
}

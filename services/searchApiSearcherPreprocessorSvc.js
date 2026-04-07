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

  function prepare(searcher) {
    if (searcher.config.apiMethod === 'POST') {
      preparePostRequest(searcher);
    } else if (searcher.config.apiMethod === 'GET') {
      prepareGetRequest(searcher);
    }
  }
}


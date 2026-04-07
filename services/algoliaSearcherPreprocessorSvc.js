'use strict';

export function algoliaSearcherPreprocessorSvcConstructor(queryTemplateSvc) {
  var self = this;
  self.prepare = prepare;

  var replaceQuery = function (qOption, args, queryText) {
    return queryTemplateSvc.hydrateSearchQuery(qOption, args, queryText);
  };

  var preparePostRequest = function (searcher) {
    var queryDsl = replaceQuery(searcher.config.qOption, searcher.args, searcher.queryText);

    searcher.queryDsl = queryDsl;
  };

  function prepare(searcher) {
    if (searcher.config.apiMethod === 'POST') {
      preparePostRequest(searcher);
    } else if (searcher.config.apiMethod === 'GET') {
      throw Error('GET is not supported by Algolia');
    }
  }
}


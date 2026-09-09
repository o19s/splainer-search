'use strict';

export function algoliaSearcherPreprocessorSvcConstructor(queryTemplateSvc) {
  var self = this;
  self.prepare = prepare;

  var replaceQuery = function (qOption, args, queryText) {
    // escapeQuery: false - see solrSearcherPreprocessorSvc.js's prepareJsonQueryDslRequest for
    // why: args is a parsed object, JSON.stringify'd wholesale at the transport layer, which
    // already escapes string values correctly - hydrateSearchQuery's own escaping only
    // double-escapes on top of that.
    return queryTemplateSvc.hydrateSearchQuery(qOption, args, queryText, { escapeQuery: false });
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

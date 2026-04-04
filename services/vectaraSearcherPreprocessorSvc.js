'use strict';

export function vectaraSearcherPreprocessorSvcConstructor(
  queryTemplateSvc,
  defaultVectaraConfig,
  utilsSvc,
) {
  const self = this;

  // Functions
  self.prepare = prepare;

  const replaceQuery = function (qOption, args, queryText) {
    return queryTemplateSvc.hydrate(args, queryText, {
      qOption: qOption,
      encodeURI: false,
      defaultKw: '\\"\\"',
    });
  };

  var preparePostRequest = function (searcher) {
    var pagerArgs = utilsSvc.deepClone(searcher.args.pager);
    if (pagerArgs === undefined || pagerArgs === null) {
      pagerArgs = {};
    }

    var defaultPagerArgs = {};

    searcher.pagerArgs = utilsSvc.deepMerge({}, defaultPagerArgs, pagerArgs);
    delete searcher.args.pager;

    var queryDsl = replaceQuery(searcher.config.qOption, searcher.args, searcher.queryText);

    searcher.queryDsl = queryDsl;
  };

  function prepare(searcher) {
    if (searcher.config === undefined) {
      searcher.config = defaultVectaraConfig;
    } else {
      // make sure config params that weren't passed through are set from
      // the default config object.
      searcher.config = utilsSvc.deepMerge({}, defaultVectaraConfig, searcher.config);
    }

    preparePostRequest(searcher);
  }
}

// Angular DI registration (removed in Phase 4)
if (typeof angular !== 'undefined') {
  angular
    .module('o19s.splainer-search')
    .service('vectaraSearcherPreprocessorSvc', [
      'queryTemplateSvc',
      'defaultVectaraConfig',
      'utilsSvc',
      vectaraSearcherPreprocessorSvcConstructor,
    ]);
}

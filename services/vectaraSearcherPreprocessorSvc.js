'use strict';

angular.module('o19s.splainer-search')
    .service('vectaraSearcherPreprocessorSvc', [
        'queryTemplateSvc',
        'defaultVectaraConfig',
        function vectaraSearcherPreprocessorSvc(queryTemplateSvc, defaultVectaraConfig) {
            const self = this;

            // Functions
            self.prepare  = prepare;

            const replaceQuery = function(args, queryText) {
                var replaced  = angular.toJson(args, true);

                replaced      = queryTemplateSvc.hydrate(replaced, queryText, {encodeURI: false, defaultKw: '\\"\\"'});
                replaced      = angular.fromJson(replaced);

                return replaced;
            };

            var preparePostRequest = function (searcher) {
                var pagerArgs = angular.copy(searcher.args.pager);
                if ( angular.isUndefined(pagerArgs) || pagerArgs === null ) {
                    pagerArgs = {};
                }

                var defaultPagerArgs = {};

                searcher.pagerArgs  = angular.merge({}, defaultPagerArgs, pagerArgs);
                delete searcher.args.pager;

                var queryDsl    = replaceQuery(searcher.args, searcher.queryText);

                searcher.queryDsl   = queryDsl;
            };

            function prepare (searcher) {
                if (searcher.config === undefined) {
                    searcher.config = defaultVectaraConfig;
                } else {
                    // make sure config params that weren't passed through are set from
                    // the default config object.
                    searcher.config = angular.merge({}, defaultVectaraConfig, searcher.config);
                }

                preparePostRequest(searcher);
            }
        }
    ]);

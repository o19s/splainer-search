'use strict';

angular.module('o19s.splainer-search')
  .service('solrSearcherPreprocessorSvc', [
    'solrUrlSvc',
    'defaultSolrConfig',
    'queryTemplateSvc',
    function solrSearcherPreprocessorSvc(solrUrlSvc, defaultSolrConfig, queryTemplateSvc) {
      var self      = this;
      self.prepare  = prepare;

      var withoutUnsupported = function (argsToUse, sanitize) {
        var argsRemoved = angular.copy(argsToUse);
        if (sanitize === true) {
          solrUrlSvc.removeUnsupported(argsRemoved);
        }
        return argsRemoved;
      };

      // the full URL we'll use to call Solr
      var buildCallUrl = function(searcher) {
        var fieldList    = searcher.fieldList;
        var hlFieldList  = searcher.hlFieldList || [];
        var url          = searcher.url;
        var config       = searcher.config;
        var args         = withoutUnsupported(searcher.args, config.sanitize);
        var queryText    = searcher.queryText;

        args.fl = (fieldList === '*') ? '*' : [fieldList.join(' ')];
        args.wt = ['json'];

        if (config.debug) {
          args.debug = ['true'];
          args['debug.explain.structured'] = ['true'];
        }

        if (config.highlight && hlFieldList.length > 0) {
          args.hl                 = ['true'];
          args['hl.method']       = ['unified'];  // work around issues parsing dates and numbers
          args['hl.fl']           = hlFieldList.join(' ');

          args['hl.simple.pre']   = [searcher.HIGHLIGHTING_PRE];
          args['hl.simple.post']  = [searcher.HIGHLIGHTING_POST];
        } else {
          args.hl = ['false'];
        }

        if (config.escapeQuery) {
          queryText = solrUrlSvc.escapeUserQuery(queryText);
        }

        if ( !args.rows ) {
          args.rows = [config.numberOfRows];
        }

        var baseUrl = solrUrlSvc.buildUrl(url, args);
        baseUrl = queryTemplateSvc.hydrate(baseUrl, queryText, {encodeURI: true, defaultKw: '""'});

        return baseUrl;
      };

      function prepare (searcher) {
        if (searcher.config === undefined) {
          searcher.config = defaultSolrConfig;
        } else {
          // make sure config params that weren't passed through are set from
          // the default config object.
          searcher.config = angular.merge({}, defaultSolrConfig, searcher.config);
        }

        searcher.callUrl = buildCallUrl(searcher);

        searcher.linkUrl = searcher.callUrl.replace('wt=json', 'wt=xml');
        searcher.linkUrl = searcher.linkUrl + '&indent=true&echoParams=all';
      }
    }
  ]);

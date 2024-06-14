'use strict';

// Executes a generic search and returns
// a set of generic documents
angular.module('o19s.splainer-search')
  .service('searchSvc', [
    'SolrSearcherFactory',
    'EsSearcherFactory',
    'VectaraSearcherFactory',
    'AlgoliaSearcherFactory',
    'A2SearcherFactory',
    'SearchApiSearcherFactory',
    'activeQueries',
    'defaultSolrConfig',
    function searchSvc(
      SolrSearcherFactory,
      EsSearcherFactory,
      VectaraSearcherFactory,
      AlgoliaSearcherFactory,
      A2SearcherFactory,
      SearchApiSearcherFactory,
      activeQueries,
      defaultSolrConfig
    ) {
      var svc = this;

      // PRE and POST strings, can't just use HTML
      // because Solr doesn't appear to support escaping
      // XML/HTML tags in the content. So we do this stupid thing
      svc.HIGHLIGHTING_PRE    = 'aouaoeuCRAZY_STRING!8_______';
      svc.HIGHLIGHTING_POST   = '62362iueaiCRAZY_POST_STRING!_______';

      this.configFromDefault = function() {
        return angular.copy(defaultSolrConfig);
      };

      this.createSearcher = function (fieldSpec, url, args, queryText, config, searchEngine) {

        if ( searchEngine === undefined ) {
          searchEngine = 'solr';
        }

        var options = {
          fieldList:      fieldSpec.fieldList(),
          hlFieldList:    fieldSpec.highlightFieldList(),
          url:            url,
          args:           args,
          queryText:      queryText,
          config:         config,
          type:           searchEngine
        };

        // if we have options.config.basicAuthCredential, then inject it into the URL
        // and let that go forward.
        if (options.config && options.config.basicAuthCredential && options.config.basicAuthCredential.length > 0) {
          options.url = this.addBasicAuthToUrl(options.url, options.config.basicAuthCredential);
        }

        var searcher;

        if ( searchEngine === 'solr') {
          options.HIGHLIGHTING_PRE  = svc.HIGHLIGHTING_PRE;
          options.HIGHLIGHTING_POST = svc.HIGHLIGHTING_POST;

          searcher = new SolrSearcherFactory(options);
        } else if ( searchEngine === 'es') {
          searcher = new EsSearcherFactory(options);
        } else if ( searchEngine === 'os') {
          searcher = new EsSearcherFactory(options);
        } else if ( searchEngine === 'vectara') {
          searcher = new VectaraSearcherFactory(options);
        } else if ( searchEngine === 'algolia') {
          searcher = new AlgoliaSearcherFactory(options);
        } else if ( searchEngine === 'a2') {
          searcher = new A2SearcherFactory(options);
        } else if ( searchEngine === 'searchapi') {
          searcher = new SearchApiSearcherFactory(options);
        }

        return searcher;
      };

      this.activeQueries = function() {
        return activeQueries.count;
      };

      this.addBasicAuthToUrl = function (url, basicAuthCredential) {
        var authUrl = url.replace('://', '://' + basicAuthCredential + '@');
        return authUrl;
      };
    }
  ]);

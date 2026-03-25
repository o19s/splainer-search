'use strict';

// Executes a generic search and returns
// a set of generic documents
angular.module('o19s.splainer-search')
  .service('searchSvc', [
    '$log',
    'SolrSearcherFactory',
    'EsSearcherFactory',
    'VectaraSearcherFactory',
    'AlgoliaSearcherFactory',
    'SearchApiSearcherFactory',
    'activeQueries',
    'defaultSolrConfig',
    'fieldSpecSvc',
    function searchSvc(
      $log,
      SolrSearcherFactory,
      EsSearcherFactory,
      VectaraSearcherFactory,
      AlgoliaSearcherFactory,
      SearchApiSearcherFactory,
      activeQueries,
      defaultSolrConfig,
      fieldSpecSvc
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

        if (options.config && options.config.basicAuthCredential && options.config.basicAuthCredential.length > 0) {
          // set up basic auth as a header
          var encoded = btoa(options.config.basicAuthCredential);
          if (options.config.customHeaders && options.config.customHeaders.length > 0) {
            // already something there, append a new entry
            let head = JSON.parse(options.config.customHeaders);
            head['Authorization'] = 'Basic ' + encoded;
            options.config.customHeaders = JSON.stringify(head);
          } else {
              // empty, so insert
            let head = { 'Authorization': 'Basic ' + encoded };
            options.config.customHeaders = JSON.stringify(head);
          }
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
        } else if ( searchEngine === 'searchapi') {
          searcher = new SearchApiSearcherFactory(options);
        }

        return searcher;
      };

      this.createValidator = function(settings) {
        var searchEngine = settings.searchEngine || 'solr';
        var args, fieldSpec;

        if (searchEngine === 'solr') {
          args      = { q: ['*:*'] };
          fieldSpec = fieldSpecSvc.createFieldSpec('*');
        } else if (searchEngine === 'es' || searchEngine === 'os') {
          args      = {};
          fieldSpec = fieldSpecSvc.createFieldSpec(null);
        } else if (searchEngine === 'vectara') {
          args = { query: [{ query: '#$query##', numResults: 10, corpusKey: [{ corpusId: 1 }] }] };
          fieldSpec = fieldSpecSvc.createFieldSpec('*');
        } else {
          args      = settings.args || {};
          fieldSpec = fieldSpecSvc.createFieldSpec('*');
        }

        return svc.createSearcher(fieldSpec, settings.searchUrl, args, '', settings, searchEngine);
      };

      this.activeQueries = function() {
        return activeQueries.count;
      };

    }
  ]);

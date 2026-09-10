'use strict';

// createValidator()'s per-engine default smoke-test args, for engines that need a
// non-empty query to return any real docs (an empty {} args wouldn't). Always used
// regardless of settings.args - a caller-supplied args wouldn't necessarily produce a
// representative field list either. Engines not listed here use settings.args (or {})
// as-is.
var VALIDATOR_ARGS_BY_ENGINE = {
  solr: { q: ['*:*'] },
  // When we have a caseOptions or engineOptions hash available, then this could look
  // like "corpusId: '#$searchOptions['corpusId]##"
  vectara: {
    query: [
      {
        query: '#$query##',
        numResults: 10,
        corpusKey: [
          {
            corpusId: 1,
          },
        ],
      },
    ],
  },
};

// createValidator()'s per-engine fieldSpec fields string. Only ES/OS need '*' overridden
// to null; everything else uses the default '*' (all fields).
var VALIDATOR_FIELDS_BY_ENGINE = {
  es: null,
  os: null,
};

// Executes a generic search and returns
// a set of generic documents
export function searchSvcConstructor(
  SolrSearcherFactory,
  EsSearcherFactory,
  VectaraSearcherFactory,
  AlgoliaSearcherFactory,
  SearchApiSearcherFactory,
  activeQueries,
  defaultSolrConfig,
  customHeadersJson,
  utilsSvc,
  fieldSpecSvc,
) {
  var svc = this;

  // PRE and POST strings, can't just use HTML
  // because Solr doesn't appear to support escaping
  // XML/HTML tags in the content. So we do this stupid thing
  svc.HIGHLIGHTING_PRE = 'aouaoeuCRAZY_STRING!8_______';
  svc.HIGHLIGHTING_POST = '62362iueaiCRAZY_POST_STRING!_______';

  this.configFromDefault = function () {
    return utilsSvc.deepClone(defaultSolrConfig);
  };

  /**
   * @param {*} fieldSpec
   * @param {string} url
   * @param {object} args
   * @param {string} queryText
   * @param {object} [config] - May include {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal | AbortSignal}
   *   as **`config.signal`** to cancel in-flight search traffic (GET/POST via `fetch`, JSONP via script removal).
   *   BULK (`_msearch`) combines per-request signals when `AbortSignal.any` exists; otherwise a composite controller is used.
   * @param {string} [searchEngine]
   */
  this.createSearcher = function (fieldSpec, url, args, queryText, config, searchEngine) {
    if (searchEngine === undefined) {
      searchEngine = 'solr';
    }

    var options = {
      fieldList: fieldSpec.fieldList(),
      hlFieldList: fieldSpec.highlightFieldList(),
      url: url,
      args: args,
      queryText: queryText,
      config: config,
      type: searchEngine,
    };

    if (
      options.config &&
      options.config.basicAuthCredential &&
      options.config.basicAuthCredential.length > 0
    ) {
      // set up basic auth as a header
      var encoded = btoa(options.config.basicAuthCredential);
      if (options.config.customHeaders && options.config.customHeaders.length > 0) {
        // already something there, append a new entry
        var parsed = customHeadersJson.tryParseObject(options.config.customHeaders);
        var head = parsed.ok ? utilsSvc.deepClone(parsed.headers) : {};
        head['Authorization'] = 'Basic ' + encoded;
        options.config.customHeaders = JSON.stringify(head);
      } else {
        // empty, so insert
        let head = { Authorization: 'Basic ' + encoded };
        options.config.customHeaders = JSON.stringify(head);
      }
    }

    var searcher;

    if (searchEngine === 'solr') {
      options.HIGHLIGHTING_PRE = svc.HIGHLIGHTING_PRE;
      options.HIGHLIGHTING_POST = svc.HIGHLIGHTING_POST;

      searcher = new SolrSearcherFactory(options);
    } else if (searchEngine === 'es') {
      searcher = new EsSearcherFactory(options);
    } else if (searchEngine === 'os') {
      searcher = new EsSearcherFactory(options);
    } else if (searchEngine === 'vectara') {
      searcher = new VectaraSearcherFactory(options);
    } else if (searchEngine === 'algolia') {
      searcher = new AlgoliaSearcherFactory(options);
    } else if (searchEngine === 'searchapi') {
      searcher = new SearchApiSearcherFactory(options);
    }

    return searcher;
  };

  // Creates a searcher pre-configured to run a smoke-test query against `settings` and (via
  // its inherited validateUrl()) discover the fields/candidate id fields it returns. Each
  // engine defaults to a sensible "give me some real docs" query when settings.args wasn't
  // explicitly provided.
  this.createValidator = function (settings) {
    var searchEngine = settings.searchEngine;
    var args = Object.hasOwn(VALIDATOR_ARGS_BY_ENGINE, searchEngine)
      ? VALIDATOR_ARGS_BY_ENGINE[searchEngine]
      : settings.args || {};
    var fields = Object.hasOwn(VALIDATOR_FIELDS_BY_ENGINE, searchEngine)
      ? VALIDATOR_FIELDS_BY_ENGINE[searchEngine]
      : '*';

    return svc.createSearcher(
      fieldSpecSvc.createFieldSpec(fields),
      settings.searchUrl,
      args,
      '',
      settings,
      searchEngine,
    );
  };

  this.activeQueries = function () {
    return activeQueries.count;
  };
}

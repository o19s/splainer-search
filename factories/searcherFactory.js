'use strict';

export function SearcherFactory(normalDocsSvc, utilsSvc) {
  var Searcher = function (options, preprocessor) {
    var self = this;

    // Methods that we expect all engines to provide
    self.fieldList = options.fieldList;
    self.hlFieldList = options.hlFieldList;
    self.url = options.url;
    // Preserved separately because some preprocessors (e.g.
    // searchApiSearcherPreprocessorSvc's prepareGetRequest) mutate self.url in place into the
    // full request URL - callers that need the pristine, pre-request URL (e.g.
    // searchApiSearcherFactory's pager(), building the next page from a clean base rather than
    // one already carrying the current page's querystring) should use this instead.
    self.originalUrl = options.url;
    self.args = options.args;
    self.queryText = options.queryText;
    self.config = options.config;
    self.type = options.type;
    self.customHeaders = options.customHeaders;

    self.docs = [];
    self.grouped = {};
    self.numFound = 0;
    self.inError = false;
    self.othersExplained = {};
    self.parsedQueryDetails = {};

    // Populated by validateUrl() - set here (not just inside validateUrl) so a caller that
    // skips validation entirely (e.g. Quepid's wizard "Skip Validation" button) still finds
    // these as empty arrays rather than undefined.
    self.fields = [];
    self.idFields = [];

    self.HIGHLIGHTING_PRE = options.HIGHLIGHTING_PRE;
    self.HIGHLIGHTING_POST = options.HIGHLIGHTING_POST;

    preprocessor.prepare(self);
  };

  // Every engine-specific searcher factory (solrSearcherFactory.js, esSearcherFactory.js, ...)
  // does `Searcher.prototype = Object.create(SearcherFactory.prototype)`, so anything added to
  // this prototype below is automatically available on every engine's searcher.

  // No engine implements doc-lookup-by-id directly on the base - each engine factory that
  // supports it overrides this. Throws rather than silently doing nothing, so a missing
  // override surfaces immediately instead of as a confusing empty-results bug.
  Searcher.prototype.fetchDocs = function () {
    throw new Error('fetchDocs is not implemented for search engine "' + this.type + '"');
  };

  // Splits ids into parallel fetchDocs calls of chunkSize and concatenates the results.
  // Dispatches through this.fetchDocs (not a hardcoded reference) so it works for whichever
  // engine subclass it's called on.
  Searcher.prototype._fetchDocsChunked = function (ids, fieldSpec, chunkSize) {
    var self = this;

    if (!(chunkSize > 0)) {
      // Matches the historical resolverFactory.js behavior: a non-positive chunk size yields
      // no slices at all, i.e. no docs.
      return Promise.resolve([]);
    }

    var slices = [];
    for (var i = 0; i < ids.length; i += chunkSize) {
      slices.push(ids.slice(i, i + chunkSize));
    }

    return Promise.all(
      slices.map(function (slice) {
        return self.fetchDocs(slice, fieldSpec);
      }),
    )
      .then(function (chunks) {
        return [].concat.apply([], chunks);
      })
      .catch(function (response) {
        console.debug('Failed to fetch docs');
        throw response;
      });
  };

  // Normalizes the docs found by a one-off resolver searcher (already `.search()`ed) into
  // NormalDocs in the same order as `ids`, substituting a placeholder stub for any id that
  // wasn't found. Shared by every engine's non-chunked fetchDocs.
  Searcher.prototype._normalizeFetchedDocs = function (ids, fieldSpec, resolverSearcher) {
    var idsToDocs = {};
    utilsSvc.safeForEach(resolverSearcher.docs, function (doc) {
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      idsToDocs[normalDoc.id] = normalDoc;
    });

    return ids.map(function (docId) {
      return Object.hasOwn(idsToDocs, docId)
        ? idsToDocs[docId]
        : normalDocsSvc.createPlaceholderDoc(docId, 'Missing Doc: ' + docId);
    });
  };

  // Builds a sibling Searcher with real doc-lookup args/queryText (via `new self.constructor`,
  // so it's the same engine subclass this was called on - every engine factory does
  // `Searcher.prototype.constructor = Searcher`), searches it, and normalizes the results.
  // Shared scaffolding for every engine's non-chunked fetchDocs - only the args/queryText/url
  // actually vary per engine, so those are the only things each engine's fetchDocs supplies.
  // `url` defaults to self.url; pass self.originalUrl explicitly for engines whose preprocessor
  // bakes a querystring into self.url in place (see self.originalUrl's own comment above).
  Searcher.prototype._fetchOneOffDocs = function (ids, fieldSpec, args, queryText, url) {
    var self = this;
    var resolverSearcher = new self.constructor({
      fieldList: fieldSpec.fieldList(),
      hlFieldList: fieldSpec.highlightFieldList(),
      url: url === undefined ? self.url : url,
      args: args,
      queryText: queryText === undefined ? null : queryText,
      config: self.config,
      type: self.type,
      HIGHLIGHTING_PRE: self.HIGHLIGHTING_PRE,
      HIGHLIGHTING_POST: self.HIGHLIGHTING_POST,
    });

    return resolverSearcher
      .search()
      .then(function () {
        return self._normalizeFetchedDocs(ids, fieldSpec, resolverSearcher);
      })
      .catch(function (response) {
        console.debug('Failed to fetch docs');
        throw response;
      });
  };

  // Extracts the raw field-value pairs from an engine-specific doc wrapper, for validateUrl()'s
  // field discovery below. Default assumes the common `{ doc: {...fields} }` shape (Solr,
  // SearchAPI, Algolia); ES/OS and Vectara override this for their own response shapes.
  Searcher.prototype._extractSourceDoc = function (doc) {
    return doc.doc;
  };

  // Fields validateUrl() should always report as available, regardless of what a validation
  // search actually returned (e.g. ES/OS documents always have `_id`, even if a match-all
  // smoke-test query happens to return zero hits to discover it from). Default: none.
  Searcher.prototype._alwaysPresentFields = [];

  // Validates the configured search by executing a real search and populating self.fields
  // (every field seen across all returned docs) and self.idFields (fields common to every
  // returned doc - candidates for a unique id field).
  Searcher.prototype.validateUrl = function () {
    var self = this;

    return self.search().then(function () {
      var candidateIds;

      // Merge fields from multiple docs because some docs might not return the entire list of
      // fields possible. Not perfect (the fetched page might not include a comprehensive list),
      // but it's the best we can do.
      utilsSvc.safeForEach(self.docs, function (doc) {
        var attributes = Object.keys(self._extractSourceDoc(doc));

        if (candidateIds === undefined) {
          candidateIds = attributes;
        } else {
          candidateIds = candidateIds.filter(function (attribute) {
            return attributes.indexOf(attribute) !== -1;
          });
        }

        self.fields = self.fields.concat(
          attributes.filter(function (attribute) {
            return self.fields.indexOf(attribute) < 0;
          }),
        );
      });

      self.idFields = candidateIds || [];

      utilsSvc.safeForEach(self._alwaysPresentFields, function (field) {
        self.fields.unshift(field);
        self.idFields.unshift(field);
      });
    });
  };

  // Return factory object
  return Searcher;
}

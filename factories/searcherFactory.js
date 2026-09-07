'use strict';

export function SearcherFactory() {
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

    self.HIGHLIGHTING_PRE = options.HIGHLIGHTING_PRE;
    self.HIGHLIGHTING_POST = options.HIGHLIGHTING_POST;

    preprocessor.prepare(self);
  };

  // Return factory object
  return Searcher;
}

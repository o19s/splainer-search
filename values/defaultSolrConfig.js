'use strict';

export var defaultSolrConfig = {
  sanitize: true,
  highlight: true,
  debug: true,
  numberOfRows: 10,
  escapeQuery: true,
  apiMethod: 'JSONP',
  // Whether args (searcher.args) came from Solr's JSON Query DSL rather than classic
  // q=...&fq=... params - required, no shape-based inference; false matches every
  // pre-JSON-DSL config/test, which is classic-shaped.
  jsonQueryDsl: false,
};

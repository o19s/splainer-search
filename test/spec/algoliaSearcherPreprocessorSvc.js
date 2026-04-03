'use strict';

/* global describe, beforeEach, inject, it, expect, module */

/**
 * Unit tests for {@link algoliaSearcherPreprocessorSvc#prepare}: POST query
 * DSL hydration and unsupported GET mode.
 */
describe('Service: algoliaSearcherPreprocessorSvc', function() {

  beforeEach(module('o19s.splainer-search'));

  var algoliaSearcherPreprocessorSvc;

  beforeEach(inject(function(_algoliaSearcherPreprocessorSvc_) {
    algoliaSearcherPreprocessorSvc = _algoliaSearcherPreprocessorSvc_;
  }));

  it('POST: hydrates queryDsl from args and queryText', function() {
    var searcher = {
      args: {
        query: '#$query##',
        hitsPerPage: 5,
        page: 0
      },
      queryText: 'algolia term',
      config: { apiMethod: 'POST', qOption: 'query' }
    };
    algoliaSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.queryDsl.query).toBe('algolia term');
    expect(searcher.queryDsl.hitsPerPage).toBe(5);
  });

  it('GET: throws a clear error', function() {
    var searcher = {
      args: {},
      queryText: 'x',
      config: { apiMethod: 'GET' }
    };
    expect(function() {
      algoliaSearcherPreprocessorSvc.prepare(searcher);
    }).toThrowError(/GET is not supported/);
  });
});

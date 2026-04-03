'use strict';

/* global describe, beforeEach, inject, it, expect, module */

/**
 * Unit tests for {@link vectaraSearcherPreprocessorSvc#prepare}: default
 * config merge and query body hydration.
 */
describe('Service: vectaraSearcherPreprocessorSvc', function() {

  beforeEach(module('o19s.splainer-search'));

  var vectaraSearcherPreprocessorSvc;

  beforeEach(inject(function(_vectaraSearcherPreprocessorSvc_) {
    vectaraSearcherPreprocessorSvc = _vectaraSearcherPreprocessorSvc_;
  }));

  it('merges default Vectara config when config is undefined', function() {
    var searcher = {
      args: {
        query: [
          {
            query: '#$query##',
            numResults: 10,
            corpusKey: [{ corpusId: 1 }]
          }
        ]
      },
      queryText: 'from test',
      config: undefined
    };
    vectaraSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.config.apiMethod).toBe('POST');
  });

  it('hydrates #$query## in the request body', function() {
    var searcher = {
      args: {
        query: [
          {
            query: '#$query##',
            numResults: 10,
            corpusKey: [{ corpusId: 1 }]
          }
        ]
      },
      queryText: 'vectaraQuery',
      config: { qOption: 'query' }
    };
    vectaraSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.queryDsl.query[0].query).toBe('vectaraQuery');
  });

  it('merges explicit config over defaultVectaraConfig', function() {
    var searcher = {
      args: { query: [{ query: '#$query##', numResults: 5, corpusKey: [] }] },
      queryText: 'q',
      config: { apiMethod: 'POST', qOption: 'query', extraOption: true }
    };
    vectaraSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.config.apiMethod).toBe('POST');
    expect(searcher.config.extraOption).toBe(true);
  });
});

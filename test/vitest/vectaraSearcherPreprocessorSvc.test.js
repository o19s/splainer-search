import { describe, it, expect, beforeEach } from 'vitest';
import { getVectaraSearcherPreprocessorSvc } from './helpers/serviceFactory.js';

describe('vectaraSearcherPreprocessorSvc', () => {
  var vectaraSearcherPreprocessorSvc;

  beforeEach(() => {
    vectaraSearcherPreprocessorSvc = getVectaraSearcherPreprocessorSvc();
  });

  it('merges default Vectara config when config is undefined', () => {
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

  it('hydrates #$query## in the request body', () => {
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

  it('merges explicit config over defaultVectaraConfig', () => {
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

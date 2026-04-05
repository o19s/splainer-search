import { describe, it, expect } from 'vitest';
import { algoliaSearcherPreprocessorSvcConstructor } from '../../services/algoliaSearcherPreprocessorSvc.js';
import { queryTemplateSvcConstructor } from '../../services/queryTemplateSvc.js';

var queryTemplateSvc = new queryTemplateSvcConstructor();

function createPreprocessorSvc() {
  return new algoliaSearcherPreprocessorSvcConstructor(queryTemplateSvc);
}

describe('algoliaSearcherPreprocessorSvc', () => {
  it('POST: hydrates queryDsl from args and queryText', () => {
    var svc = createPreprocessorSvc();
    var searcher = {
      args: {
        query: '#$query##',
        hitsPerPage: 5,
        page: 0
      },
      queryText: 'algolia term',
      config: { apiMethod: 'POST', qOption: 'query' }
    };
    svc.prepare(searcher);
    expect(searcher.queryDsl.query).toBe('algolia term');
    expect(searcher.queryDsl.hitsPerPage).toBe(5);
  });

  it('GET: throws a clear error', () => {
    var svc = createPreprocessorSvc();
    var searcher = {
      args: {},
      queryText: 'x',
      config: { apiMethod: 'GET' }
    };
    expect(function() {
      svc.prepare(searcher);
    }).toThrowError(/GET is not supported/);
  });
});

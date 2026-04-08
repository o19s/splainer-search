import { describe, it, expect, beforeEach } from 'vitest';
import { getEsSearcherPreprocessorSvc } from './helpers/serviceFactory.js';

describe('esSearcherPreprocessorSvc', () => {
  var esSearcherPreprocessorSvc;

  beforeEach(() => {
    esSearcherPreprocessorSvc = getEsSearcherPreprocessorSvc();
  });

  it('POST: merges pager into pagerArgs and strips args.pager', () => {
    var searcher = {
      fieldList: ['field1'],
      hlFieldList: [],
      url: 'http://localhost:9200/i/_search',
      args: {
        query: { term: { t: '#$query##' } },
        pager: { from: 5, size: 7 },
      },
      queryText: 'hello',
      config: { apiMethod: 'POST', qOption: 'query', numberOfRows: 10 },
    };
    esSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.pagerArgs.from).toBe(5);
    expect(searcher.pagerArgs.size).toBe(7);
    expect(searcher.args.pager).toBeUndefined();
  });

  it('POST: sets explain and profile on the query DSL', () => {
    var searcher = {
      fieldList: ['a'],
      args: { query: { match_all: {} } },
      queryText: 'x',
      config: { apiMethod: 'POST', qOption: 'query', numberOfRows: 10 },
    };
    esSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.queryDsl.explain).toBe(true);
    expect(searcher.queryDsl.profile).toBe(true);
  });

  it('POST: uses object queryText as the DSL base without string templating', () => {
    var dsl = { query: { match_all: {} } };
    var searcher = {
      fieldList: null,
      args: {},
      queryText: dsl,
      config: { apiMethod: 'POST', numberOfRows: 10, qOption: 'query' },
    };
    esSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.queryDsl).toBe(dsl);
    expect(dsl.explain).toBe(true);
    expect(dsl.profile).toBe(true);
  });

  it('POST: omits _id from highlight fields when _source lists _id', () => {
    var searcher = {
      fieldList: ['_id', 'title'],
      args: { query: { term: { x: '#$query##' } } },
      queryText: 'q',
      config: { apiMethod: 'POST', numberOfRows: 10, qOption: 'query' },
    };
    esSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.queryDsl.highlight.fields._id).toBeUndefined();
    expect(searcher.queryDsl.highlight.fields.title).toEqual({});
  });

  it('GET: appends query and size to the URL', () => {
    var searcher = {
      fieldList: null,
      url: 'http://localhost:9200/i/_search',
      args: {},
      queryText: 'foo',
      config: { apiMethod: 'GET', numberOfRows: 15 },
    };
    esSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.url.indexOf('q=foo')).not.toBe(-1);
    expect(searcher.url.indexOf('size=15')).not.toBe(-1);
  });
});

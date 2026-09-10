import { describe, it, expect, vi } from 'vitest';
import { getSearcherConstructor, getSolrDocConstructor } from './helpers/serviceFactory.js';

var SearcherConstructor = getSearcherConstructor();

function baseOptions(overrides) {
  return Object.assign(
    {
      fieldList: ['f'],
      hlFieldList: ['h'],
      url: 'http://localhost/s',
      args: { q: ['*:*'] },
      queryText: 'q',
      config: { numberOfRows: 10 },
      type: 'solr',
      customHeaders: '',
      HIGHLIGHTING_PRE: '<em>',
      HIGHLIGHTING_POST: '</em>',
    },
    overrides,
  );
}

describe('SearcherFactory', () => {
  it('runs preprocessor.prepare on the new searcher and copies core options', () => {
    var preprocessor = {
      prepare: vi.fn(),
    };
    var options = baseOptions();
    var s = new SearcherConstructor(options, preprocessor);

    expect(preprocessor.prepare).toHaveBeenCalledWith(s);
    expect(s.fieldList).toEqual(['f']);
    expect(s.url).toBe(options.url);
    expect(s.args).toEqual(options.args);
    expect(s.docs).toEqual([]);
    expect(s.numFound).toBe(0);
    expect(s.inError).toBe(false);
  });

  it('starts with empty fields/idFields, before validateUrl ever runs', () => {
    var s = new SearcherConstructor(baseOptions(), { prepare: vi.fn() });
    expect(s.fields).toEqual([]);
    expect(s.idFields).toEqual([]);
  });

  it('fetchDocs throws by default (no engine override)', () => {
    var s = new SearcherConstructor(baseOptions(), { prepare: vi.fn() });
    expect(() => s.fetchDocs(['a'], {})).toThrow(/fetchDocs is not implemented/);
  });

  describe('_extractSourceDoc', () => {
    it('defaults to doc.doc', () => {
      var s = new SearcherConstructor(baseOptions(), { prepare: vi.fn() });
      expect(s._extractSourceDoc({ doc: { title: 'x' } })).toEqual({ title: 'x' });
    });
  });

  describe('_alwaysPresentFields', () => {
    it('defaults to an empty list', () => {
      var s = new SearcherConstructor(baseOptions(), { prepare: vi.fn() });
      expect(s._alwaysPresentFields).toEqual([]);
    });
  });

  describe('_normalizeFetchedDocs', () => {
    it('normalizes found docs and stubs out missing ids, preserving requested order', () => {
      var s = new SearcherConstructor(baseOptions(), { prepare: vi.fn() });
      var SolrDocFactory = getSolrDocConstructor();
      var docOptions = {
        url: 'http://localhost:8983/solr/collection1/select',
        explDict: {},
        hlDict: {},
        fieldList: '*',
        highlightingPre: 'em',
        highlightingPost: '/em',
      };
      var fieldSpec = { id: 'id', fieldList: () => '*', highlightFieldList: () => [] };
      var resolverSearcher = {
        docs: [
          new SolrDocFactory({ id: 'doc2', title: 'Two' }, docOptions),
          new SolrDocFactory({ id: 'doc1', title: 'One' }, docOptions),
        ],
      };

      var result = s._normalizeFetchedDocs(['doc1', 'doc2', 'doc3'], fieldSpec, resolverSearcher);

      expect(result.map((d) => d.id)).toEqual(['doc1', 'doc2', 'doc3']);
      expect(result[2].title).toBe('Missing Doc: doc3');
    });
  });

  describe('_fetchDocsChunked', () => {
    it('slices ids into chunkSize groups and dispatches through this.fetchDocs', async () => {
      var s = new SearcherConstructor(baseOptions(), { prepare: vi.fn() });
      var calls = [];
      s.fetchDocs = function (ids) {
        calls.push(ids);
        return Promise.resolve(ids.map((id) => ({ id })));
      };

      var result = await s._fetchDocsChunked(['a', 'b', 'c', 'd', 'e'], {}, 2);

      expect(calls).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
      expect(result.map((d) => d.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('resolves to an empty array for a non-positive chunk size', async () => {
      var s = new SearcherConstructor(baseOptions(), { prepare: vi.fn() });
      var result = await s._fetchDocsChunked(['a', 'b'], {}, 0);
      expect(result).toEqual([]);
    });

    it('propagates a rejection from any chunk', async () => {
      var s = new SearcherConstructor(baseOptions(), { prepare: vi.fn() });
      s.fetchDocs = function () {
        return Promise.reject(new Error('boom'));
      };
      await expect(s._fetchDocsChunked(['a', 'b'], {}, 1)).rejects.toThrow('boom');
    });
  });

  describe('validateUrl', () => {
    it('unions fields across docs and intersects idFields', async () => {
      var s = new SearcherConstructor(baseOptions(), { prepare: vi.fn() });
      s.search = function () {
        s.docs = [{ doc: { id: '1', title: 'a' } }, { doc: { id: '2', overview: 'b' } }];
        return Promise.resolve();
      };

      await s.validateUrl();

      expect(s.fields.sort()).toEqual(['id', 'overview', 'title']);
      expect(s.idFields).toEqual(['id']);
    });

    it('unshifts _alwaysPresentFields even with zero results', async () => {
      var s = new SearcherConstructor(baseOptions(), { prepare: vi.fn() });
      s.search = function () {
        s.docs = [];
        return Promise.resolve();
      };
      s._alwaysPresentFields = ['_id'];

      await s.validateUrl();

      expect(s.fields).toEqual(['_id']);
      expect(s.idFields).toEqual(['_id']);
    });

    it('rejects when the underlying search rejects', async () => {
      var s = new SearcherConstructor(baseOptions(), { prepare: vi.fn() });
      s.search = function () {
        return Promise.reject(new Error('search failed'));
      };
      await expect(s.validateUrl()).rejects.toThrow('search failed');
    });
  });
});

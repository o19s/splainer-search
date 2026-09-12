import { describe, it, expect } from 'vitest';
import { getAlgoliaDocConstructor } from './helpers/serviceFactory.js';

var AlgoliaDocFactory = getAlgoliaDocConstructor();

describe('AlgoliaDocFactory', () => {
  it('should be defined', () => {
    expect(AlgoliaDocFactory).toBeDefined();
  });

  it('should create a doc with single-element arrays flattened', () => {
    var mockDoc = {
      objectID: 'test123',
      title: ['Single Title'],
      description: 'Regular string',
      tags: ['tag1', 'tag2', 'tag3'],
    };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    expect(doc.title).toEqual('Single Title');
    expect(doc.description).toEqual('Regular string');
    expect(doc.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });

  it('should handle null field values without error', () => {
    var mockDoc = { objectID: 'test123', title: null, description: 'Regular string' };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    expect(doc.title).toBeNull();
    expect(doc.description).toEqual('Regular string');
  });

  it('should handle undefined field values without error', () => {
    var mockDoc = {
      objectID: 'test123',
      title: undefined,
      description: 'Regular string',
      tags: ['single tag'],
    };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    expect(doc.title).toBeUndefined();
    expect(doc.description).toEqual('Regular string');
    expect(doc.tags).toEqual('single tag');
  });

  it('should handle mixed field types including undefined', () => {
    var mockDoc = {
      objectID: 'test123',
      title: ['Single Title'],
      description: undefined,
      price: null,
      tags: ['tag1', 'tag2'],
      category: 'Electronics',
      inStock: true,
    };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    expect(doc.title).toEqual('Single Title');
    expect(doc.description).toBeUndefined();
    expect(doc.price).toBeNull();
    expect(doc.tags).toEqual(['tag1', 'tag2']);
    expect(doc.category).toEqual('Electronics');
    expect(doc.inStock).toBe(true);
  });

  it('should not flatten empty arrays', () => {
    var mockDoc = { objectID: 'test123', title: 'Test Title', tags: [] };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    expect(doc.title).toEqual('Test Title');
    expect(doc.tags).toEqual([]);
  });

  it('should handle complex nested objects', () => {
    var mockDoc = {
      objectID: 'test123',
      title: ['Single Title'],
      metadata: { author: 'John Doe', year: 2023 },
      scores: [42],
    };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    expect(doc.title).toEqual('Single Title');
    expect(doc.metadata).toEqual({ author: 'John Doe', year: 2023 });
    expect(doc.scores).toEqual(42);
  });

  it('should return null for url method', () => {
    var doc = new AlgoliaDocFactory({ objectID: 'test123', title: 'Test' }, {});
    expect(doc._url()).toBeNull();
  });

  it('should return empty object for explain when the doc has no _rankingInfo at all', () => {
    var doc = new AlgoliaDocFactory({ objectID: 'test123', title: 'Test' }, {});
    expect(doc.explain()).toEqual({});
  });

  it('should merge _rankingInfo (including userScore) into explain, pinning value/description/details/match', () => {
    var mockDoc = {
      objectID: 'test123',
      title: 'Test',
      _rankingInfo: {
        nbTypos: 0,
        firstMatchedWord: 1000,
        proximityDistance: 1,
        userScore: 872104,
        nbExactWords: 2,
        words: 2,
        filters: 0,
      },
    };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    var explain = doc.explain();
    // Pinned safe-default fields - identical to explainSvc.js's own placeholder shape, so
    // doc.score()/a host app's per-term breakdown chart stay unaffected by real _rankingInfo data.
    expect(explain.value).toEqual(0);
    expect(explain.description).toEqual('');
    expect(explain.details).toEqual([]);
    expect(explain.match).toBe(true);
    // The full _rankingInfo rides along underneath, for explain().rawStr() to show as-is.
    expect(explain.userScore).toEqual(872104);
    expect(explain.nbTypos).toEqual(0);
    expect(explain.words).toEqual(2);
  });

  it('does not let _rankingInfo fields override the pinned safe-default fields, even if they collide', () => {
    var mockDoc = {
      objectID: 'test123',
      title: 'Test',
      _rankingInfo: { value: 999, description: 'should not win', details: ['x'], match: false },
    };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    var explain = doc.explain();
    expect(explain.value).toEqual(0);
    expect(explain.description).toEqual('');
    expect(explain.details).toEqual([]);
    expect(explain.match).toBe(true);
  });

  it('should return null for snippet when the doc has no _snippetResult at all', () => {
    var doc = new AlgoliaDocFactory({ objectID: 'test123', title: 'Test' }, {});
    expect(doc.snippet('test123', 'title')).toBeNull();
  });

  it('should return null for highlight when the doc has no _highlightResult at all', () => {
    var doc = new AlgoliaDocFactory({ objectID: 'test123', title: 'Test' }, {});
    expect(doc.highlight('test123', 'title', '<strong>', '</strong>')).toBeNull();
  });

  it('should return null for snippet/highlight when the field has no match', () => {
    var mockDoc = {
      objectID: 'test123',
      title: 'Test',
      _snippetResult: { overview: { value: 'a match', matchLevel: 'full' } },
      _highlightResult: { overview: { value: 'a match', matchLevel: 'full' } },
    };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    expect(doc.snippet('test123', 'title')).toBeNull();
    expect(doc.highlight('test123', 'title', '<strong>', '</strong>')).toBeNull();
  });

  it('should return the raw <em>-tagged snippet for a scalar field', () => {
    var mockDoc = {
      objectID: 'test123',
      title: 'Star',
      _snippetResult: { title: { value: '<em>Star</em>', matchLevel: 'full' } },
    };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    expect(doc.snippet('test123', 'title')).toEqual(['<em>Star</em>']);
  });

  it('should convert <em> tags to the requested pre/post text for a scalar field', () => {
    var mockDoc = {
      objectID: 'test123',
      title: 'Star',
      _highlightResult: { title: { value: '<em>Star</em>', matchLevel: 'full' } },
    };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    expect(doc.highlight('test123', 'title', '<strong>', '</strong>')).toEqual([
      '<strong>Star</strong>',
    ]);
  });

  it('should handle an array field, extracting .value from each per-entry highlight object', () => {
    var mockDoc = {
      objectID: 'test123',
      cast: ['Tom Hanks', 'Meg Ryan'],
      _highlightResult: {
        cast: [
          { value: '<em>Tom Hanks</em>', matchLevel: 'full' },
          { value: 'Meg Ryan', matchLevel: 'none' },
        ],
      },
    };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    expect(doc.highlight('test123', 'cast', '<strong>', '</strong>')).toEqual([
      '<strong>Tom Hanks</strong>',
      'Meg Ryan',
    ]);
  });

  it('should return origin without function properties or Algolia response metadata', () => {
    var mockDoc = {
      objectID: 'test123',
      title: 'Test Title',
      description: 'Test Description',
      _highlightResult: { title: { value: 'Test Title', matchLevel: 'none' } },
      _snippetResult: { title: { value: 'Test Title', matchLevel: 'none' } },
      _rankingInfo: { nbTypos: 0 },
    };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    var origin = doc.origin();
    expect(origin.title).toEqual('Test Title');
    expect(origin.description).toEqual('Test Description');
    expect(origin._url).toBeUndefined();
    expect(origin.explain).toBeUndefined();
    expect(origin.doc).toBeUndefined();
    expect(origin._highlightResult).toBeUndefined();
    expect(origin._snippetResult).toBeUndefined();
    expect(origin._rankingInfo).toBeUndefined();
  });
});

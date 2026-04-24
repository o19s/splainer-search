import { describe, it, expect } from 'vitest';
import { getEsDocConstructor } from './helpers/serviceFactory.js';

var EsDocFactory = getEsDocConstructor();

describe('EsDocFactory', () => {
  it('should be defined', () => {
    expect(EsDocFactory).toBeDefined();
  });

  it('should create a doc with single-element arrays flattened', () => {
    var mockDoc = {
      _id: 'test123',
      _source: {
        title: ['Single Title'],
        description: 'Regular string',
        tags: ['tag1', 'tag2', 'tag3'],
      },
    };
    var doc = new EsDocFactory(mockDoc, {});
    expect(doc.title).toEqual('Single Title');
    expect(doc.description).toEqual('Regular string');
    expect(doc.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });

  it('should handle null field values without error', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: null, description: 'Regular string' },
    };
    var doc = new EsDocFactory(mockDoc, {});
    expect(doc.title).toBeNull();
    expect(doc.description).toEqual('Regular string');
  });

  it('should handle undefined field values without error', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: undefined, description: 'Regular string', tags: ['single tag'] },
    };
    var doc = new EsDocFactory(mockDoc, {});
    expect(doc.title).toBeUndefined();
    expect(doc.description).toEqual('Regular string');
    expect(doc.tags).toEqual('single tag');
  });

  it('should handle mixed field types including undefined', () => {
    var mockDoc = {
      _id: 'test123',
      _source: {
        title: ['Single Title'],
        description: undefined,
        price: null,
        tags: ['tag1', 'tag2'],
        category: 'Electronics',
        inStock: true,
      },
    };
    var doc = new EsDocFactory(mockDoc, {});
    expect(doc.title).toEqual('Single Title');
    expect(doc.description).toBeUndefined();
    expect(doc.price).toBeNull();
    expect(doc.tags).toEqual(['tag1', 'tag2']);
    expect(doc.category).toEqual('Electronics');
    expect(doc.inStock).toBe(true);
  });

  it('should not flatten empty arrays', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: 'Test Title', tags: [] },
    };
    var doc = new EsDocFactory(mockDoc, {});
    expect(doc.title).toEqual('Test Title');
    expect(doc.tags).toEqual([]);
  });

  it('should handle fields property alongside _source', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: 'Source Title' },
      fields: { computed_field: ['Single Value'] },
    };
    var doc = new EsDocFactory(mockDoc, {});
    expect(doc.title).toEqual('Source Title');
    expect(doc.computed_field).toEqual('Single Value');
  });

  it('should handle complex nested objects', () => {
    var mockDoc = {
      _id: 'test123',
      _source: {
        title: ['Single Title'],
        metadata: { author: 'John Doe', year: 2023 },
        scores: [42],
      },
    };
    var doc = new EsDocFactory(mockDoc, {});
    expect(doc.title).toEqual('Single Title');
    expect(doc.metadata).toEqual({ author: 'John Doe', year: 2023 });
    expect(doc.scores).toEqual(42);
  });

  it('should delete highlight property', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: 'Test Title' },
      highlight: { title: ['<em>Test</em> Title'] },
    };
    var doc = new EsDocFactory(mockDoc, {});
    expect(doc.title).toEqual('Test Title');
    expect(doc.highlight).toBeDefined();
    expect(typeof doc.highlight).toBe('function');
  });

  it('should return snippet for highlighted fields', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: 'Test Title' },
      highlight: { title: ['<em>Test</em> Title'] },
    };
    var doc = new EsDocFactory(mockDoc, {});
    var snippet = doc.snippet('test123', 'title');
    expect(snippet).toEqual(['<em>Test</em> Title']);
  });

  it('should return null for snippet when field not highlighted', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: 'Test Title', description: 'Test Description' },
      highlight: { title: ['<em>Test</em> Title'] },
    };
    var doc = new EsDocFactory(mockDoc, {});
    var snippet = doc.snippet('test123', 'description');
    expect(snippet).toBeNull();
  });

  it('should return null for snippet when no highlights', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: 'Test Title' },
    };
    var doc = new EsDocFactory(mockDoc, {});
    var snippet = doc.snippet('test123', 'title');
    expect(snippet).toBeNull();
  });

  it('should return formatted highlight with custom pre and post text', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: 'Test Title' },
      highlight: { title: ['<em>Test</em> Title', 'Another <em>Test</em>'] },
    };
    var doc = new EsDocFactory(mockDoc, {});
    var highlight = doc.highlight('test123', 'title', '[[HIGHLIGHT]]', '[[/HIGHLIGHT]]');
    expect(highlight).toEqual([
      '[[HIGHLIGHT]]Test[[/HIGHLIGHT]] Title',
      'Another [[HIGHLIGHT]]Test[[/HIGHLIGHT]]',
    ]);
  });

  it('should return null for highlight when field not highlighted', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: 'Test Title' },
      highlight: { title: ['<em>Test</em> Title'] },
    };
    var doc = new EsDocFactory(mockDoc, {});
    var highlight = doc.highlight('test123', 'description', '**', '**');
    expect(highlight).toBeNull();
  });

  it('should return origin without function properties and internal fields', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: 'Test Title', description: 'Test Description' },
    };
    var doc = new EsDocFactory(mockDoc, {});
    var origin = doc.origin();
    expect(origin.title).toEqual('Test Title');
    expect(origin.description).toEqual('Test Description');
    expect(origin._url).toBeUndefined();
    expect(origin.explain).toBeUndefined();
    expect(origin.doc).toBeUndefined();
    expect(origin.fields).toBeUndefined();
    expect(origin._explanation).toBeUndefined();
    expect(origin.highlight).toBeUndefined();
  });

  it('should return explain dict when provided in options', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: 'Test Title' },
    };
    var explainDict = { value: 1.0, description: 'test explanation' };
    var doc = new EsDocFactory(mockDoc, { explDict: explainDict });
    expect(doc.explain()).toEqual(explainDict);
  });

  it('should handle undefined in fields property without error', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: 'Source Title' },
      fields: { computed_field: undefined, another_field: ['value'] },
    };
    var doc = new EsDocFactory(mockDoc, {});
    expect(doc.computed_field).toBeUndefined();
    expect(doc.another_field).toEqual('value');
  });

  it('should handle both _source and fields with undefined values', () => {
    var mockDoc = {
      _id: 'test123',
      _source: { title: undefined, description: ['Single Description'] },
      fields: { computed_field: undefined, score_field: [100] },
    };
    var doc = new EsDocFactory(mockDoc, {});
    expect(doc.title).toBeUndefined();
    expect(doc.description).toEqual('Single Description');
    expect(doc.computed_field).toBeUndefined();
    expect(doc.score_field).toEqual(100);
  });
});

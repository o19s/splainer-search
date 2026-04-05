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
      tags: ['tag1', 'tag2', 'tag3']
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
      objectID: 'test123', title: undefined,
      description: 'Regular string', tags: ['single tag']
    };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    expect(doc.title).toBeUndefined();
    expect(doc.description).toEqual('Regular string');
    expect(doc.tags).toEqual('single tag');
  });

  it('should handle mixed field types including undefined', () => {
    var mockDoc = {
      objectID: 'test123',
      title: ['Single Title'], description: undefined,
      price: null, tags: ['tag1', 'tag2'],
      category: 'Electronics', inStock: true
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
      scores: [42]
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

  it('should return empty object for explain method', () => {
    var doc = new AlgoliaDocFactory({ objectID: 'test123', title: 'Test' }, {});
    expect(doc.explain()).toEqual({});
  });

  it('should return null for snippet method', () => {
    var doc = new AlgoliaDocFactory({ objectID: 'test123', title: 'Test' }, {});
    expect(doc.snippet()).toBeNull();
  });

  it('should return null for highlight method', () => {
    var doc = new AlgoliaDocFactory({ objectID: 'test123', title: 'Test' }, {});
    expect(doc.highlight()).toBeNull();
  });

  it('should return origin without function properties', () => {
    var mockDoc = { objectID: 'test123', title: 'Test Title', description: 'Test Description' };
    var doc = new AlgoliaDocFactory(mockDoc, {});
    var origin = doc.origin();
    expect(origin.title).toEqual('Test Title');
    expect(origin.description).toEqual('Test Description');
    expect(origin._url).toBeUndefined();
    expect(origin.explain).toBeUndefined();
    expect(origin.doc).toBeUndefined();
  });
});

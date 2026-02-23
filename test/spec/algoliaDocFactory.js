'use strict';

describe('Factory: AlgoliaDocFactory', function () {
  beforeEach(module('o19s.splainer-search'));

  var AlgoliaDocFactory;

  beforeEach(inject(function (_AlgoliaDocFactory_) {
    AlgoliaDocFactory = _AlgoliaDocFactory_;
  }));

  it('should be defined', function () {
    expect(AlgoliaDocFactory).toBeDefined();
  });

  it('should create a doc with single-element arrays flattened', function () {
    var mockDoc = {
      objectID: 'test123',
      title: ['Single Title'],
      description: 'Regular string',
      tags: ['tag1', 'tag2', 'tag3']
    };

    var options = {};
    var doc = new AlgoliaDocFactory(mockDoc, options);

    expect(doc.title).toEqual('Single Title');
    expect(doc.description).toEqual('Regular string');
    expect(doc.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });

  it('should handle null field values without error', function () {
    var mockDoc = {
      objectID: 'test123',
      title: null,
      description: 'Regular string'
    };

    var options = {};
    var doc = new AlgoliaDocFactory(mockDoc, options);

    expect(doc.title).toBeNull();
    expect(doc.description).toEqual('Regular string');
  });

  it('should handle undefined field values without error', function () {
    var mockDoc = {
      objectID: 'test123',
      title: undefined,
      description: 'Regular string',
      tags: ['single tag']
    };

    var options = {};
    var doc = new AlgoliaDocFactory(mockDoc, options);

    expect(doc.title).toBeUndefined();
    expect(doc.description).toEqual('Regular string');
    expect(doc.tags).toEqual('single tag');
  });

  it('should handle mixed field types including undefined', function () {
    var mockDoc = {
      objectID: 'test123',
      title: ['Single Title'],
      description: undefined,
      price: null,
      tags: ['tag1', 'tag2'],
      category: 'Electronics',
      inStock: true
    };

    var options = {};
    var doc = new AlgoliaDocFactory(mockDoc, options);

    expect(doc.title).toEqual('Single Title');
    expect(doc.description).toBeUndefined();
    expect(doc.price).toBeNull();
    expect(doc.tags).toEqual(['tag1', 'tag2']);
    expect(doc.category).toEqual('Electronics');
    expect(doc.inStock).toBe(true);
  });

  it('should not flatten empty arrays', function () {
    var mockDoc = {
      objectID: 'test123',
      title: 'Test Title',
      tags: []
    };

    var options = {};
    var doc = new AlgoliaDocFactory(mockDoc, options);

    expect(doc.title).toEqual('Test Title');
    expect(doc.tags).toEqual([]);
  });

  it('should handle complex nested objects', function () {
    var mockDoc = {
      objectID: 'test123',
      title: ['Single Title'],
      metadata: {
        author: 'John Doe',
        year: 2023
      },
      scores: [42]
    };

    var options = {};
    var doc = new AlgoliaDocFactory(mockDoc, options);

    expect(doc.title).toEqual('Single Title');
    expect(doc.metadata).toEqual({
      author: 'John Doe',
      year: 2023
    });
    expect(doc.scores).toEqual(42);
  });

  it('should return null for url method', function () {
    var mockDoc = {
      objectID: 'test123',
      title: 'Test'
    };

    var options = {};
    var doc = new AlgoliaDocFactory(mockDoc, options);

    expect(doc._url()).toBeNull();
  });

  it('should return empty object for explain method', function () {
    var mockDoc = {
      objectID: 'test123',
      title: 'Test'
    };

    var options = {};
    var doc = new AlgoliaDocFactory(mockDoc, options);

    expect(doc.explain()).toEqual({});
  });

  it('should return null for snippet method', function () {
    var mockDoc = {
      objectID: 'test123',
      title: 'Test'
    };

    var options = {};
    var doc = new AlgoliaDocFactory(mockDoc, options);

    expect(doc.snippet()).toBeNull();
  });

  it('should return null for highlight method', function () {
    var mockDoc = {
      objectID: 'test123',
      title: 'Test'
    };

    var options = {};
    var doc = new AlgoliaDocFactory(mockDoc, options);

    expect(doc.highlight()).toBeNull();
  });

  it('should return origin without function properties', function () {
    var mockDoc = {
      objectID: 'test123',
      title: 'Test Title',
      description: 'Test Description'
    };

    var options = {};
    var doc = new AlgoliaDocFactory(mockDoc, options);
    var origin = doc.origin();

    expect(origin.title).toEqual('Test Title');
    expect(origin.description).toEqual('Test Description');
    expect(origin._url).toBeUndefined();
    expect(origin.explain).toBeUndefined();
    expect(origin.doc).toBeUndefined();
  });
});
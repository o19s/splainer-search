import { describe, it, expect, beforeEach } from 'vitest';
import { getVectaraDocConstructor } from './helpers/serviceFactory.js';

describe('VectaraDocFactory', () => {
  var VectaraDocFactory;

  beforeEach(() => {
    VectaraDocFactory = getVectaraDocConstructor();
  });

  it('should be defined', () => {
    expect(VectaraDocFactory).toBeDefined();
  });

  var makeDoc = function(rawDoc, options) {
    options = options || {};
    return new VectaraDocFactory(rawDoc, options);
  };

  describe('field extraction from metadata', () => {
    it('extracts fields from metadata array', () => {
      VectaraDocFactory = getVectaraDocConstructor();
      var rawDoc = {
        metadata: [
          { name: 'title', value: 'Test Document' },
          { name: 'author', value: 'Jane Doe' }
        ]
      };
      var doc = makeDoc(rawDoc);
      expect(doc.title).toEqual('Test Document');
      expect(doc.author).toEqual('Jane Doe');
    });

    it('flattens single-element arrays', () => {
      VectaraDocFactory = getVectaraDocConstructor();
      var rawDoc = {
        metadata: [
          { name: 'title', value: ['Only Title'] },
          { name: 'tags', value: ['tag1', 'tag2'] }
        ]
      };
      var doc = makeDoc(rawDoc);
      expect(doc.title).toEqual('Only Title');
      expect(doc.tags).toEqual(['tag1', 'tag2']);
    });

    it('treats missing or null metadata as empty', () => {
      VectaraDocFactory = getVectaraDocConstructor();
      expect(function() { makeDoc({}); }).not.toThrow();
      expect(function() { makeDoc({ metadata: null }); }).not.toThrow();
      var doc = makeDoc({});
      expect(doc.fieldsProperty()).toEqual({});
    });
  });

  describe('origin', () => {
    it('returns non-function properties excluding doc, metadata, opts', () => {
      VectaraDocFactory = getVectaraDocConstructor();
      var rawDoc = {
        metadata: [{ name: 'title', value: 'Test' }]
      };
      var doc = makeDoc(rawDoc);
      var orig = doc.origin();
      expect(orig.title).toEqual('Test');
      expect(orig.doc).toBeUndefined();
      expect(orig.metadata).toBeUndefined();
      expect(orig.opts).toBeUndefined();
    });
  });

  describe('explain', () => {
    it('returns empty object (not implemented)', () => {
      VectaraDocFactory = getVectaraDocConstructor();
      var doc = makeDoc({ metadata: [] });
      expect(doc.explain()).toEqual({});
    });
  });

  describe('snippet', () => {
    it('returns null (not implemented)', () => {
      VectaraDocFactory = getVectaraDocConstructor();
      var doc = makeDoc({ metadata: [] });
      expect(doc.snippet()).toBeNull();
    });
  });

  describe('highlight', () => {
    it('returns null (not implemented)', () => {
      VectaraDocFactory = getVectaraDocConstructor();
      var doc = makeDoc({ metadata: [] });
      expect(doc.highlight()).toBeNull();
    });
  });

  describe('_url', () => {
    it('returns unavailable', () => {
      VectaraDocFactory = getVectaraDocConstructor();
      var doc = makeDoc({ metadata: [] });
      expect(doc._url()).toEqual('unavailable');
    });
  });
});

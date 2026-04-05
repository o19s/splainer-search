import { describe, it, expect } from 'vitest';
import { getSearchApiDocConstructor } from './helpers/serviceFactory.js';

var SearchApiDocFactory = getSearchApiDocConstructor();

var makeDoc = function(rawDoc, options) {
  options = options || {};
  return new SearchApiDocFactory(rawDoc, options);
};

describe('SearchApiDocFactory', () => {
  it('should be defined', () => {
    expect(SearchApiDocFactory).toBeDefined();
  });

  describe('field extraction', () => {
    it('copies fields from doc to instance', () => {
      var rawDoc = {
        _source: { title: 'Test', author: 'John' },
        id: '123'
      };
      var doc = makeDoc(rawDoc);
      expect(doc.id).toEqual('123');
    });

    it('flattens single-element arrays', () => {
      var rawDoc = {
        title: ['Only Title'],
        tags: ['tag1', 'tag2']
      };
      var doc = makeDoc(rawDoc);
      expect(doc.title).toEqual('Only Title');
      expect(doc.tags).toEqual(['tag1', 'tag2']);
    });

    it('handles null field values', () => {
      var rawDoc = { title: null, desc: 'OK' };
      var doc = makeDoc(rawDoc);
      expect(doc.title).toBeNull();
      expect(doc.desc).toEqual('OK');
    });
  });

  describe('origin', () => {
    it('returns non-function properties excluding doc', () => {
      var rawDoc = { id: '1', title: 'Test' };
      var doc = makeDoc(rawDoc);
      var orig = doc.origin();
      expect(orig.id).toEqual('1');
      expect(orig.title).toEqual('Test');
      expect(orig.doc).toBeUndefined();
    });
  });

  describe('explain', () => {
    it('returns empty object (not implemented)', () => {
      var doc = makeDoc({ id: '1' });
      expect(doc.explain()).toEqual({});
    });
  });

  describe('snippet', () => {
    it('returns null (not implemented)', () => {
      var doc = makeDoc({ id: '1' });
      expect(doc.snippet()).toBeNull();
    });
  });

  describe('highlight', () => {
    it('returns null (not implemented)', () => {
      var doc = makeDoc({ id: '1' });
      expect(doc.highlight()).toBeNull();
    });
  });

  describe('_url', () => {
    it('returns null (not implemented)', () => {
      var doc = makeDoc({ id: '1' });
      expect(doc._url()).toBeNull();
    });
  });
});

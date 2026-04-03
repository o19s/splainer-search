'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Factory: VectaraDocFactory', function () {

  beforeEach(module('o19s.splainer-search'));

  var VectaraDocFactory;

  beforeEach(inject(function (_VectaraDocFactory_) {
    VectaraDocFactory = _VectaraDocFactory_;
  }));

  it('should be defined', function () {
    expect(VectaraDocFactory).toBeDefined();
  });

  var makeDoc = function(rawDoc, options) {
    options = options || {};
    return new VectaraDocFactory(rawDoc, options);
  };

  describe('field extraction from metadata', function() {

    it('extracts fields from metadata array', function() {
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

    it('flattens single-element arrays', function() {
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

    it('treats missing or null metadata as empty', function() {
      expect(function() { makeDoc({}); }).not.toThrow();
      expect(function() { makeDoc({ metadata: null }); }).not.toThrow();
      var doc = makeDoc({});
      expect(doc.fieldsProperty()).toEqual({});
    });
  });

  describe('origin', function() {

    it('returns non-function properties excluding doc, metadata, opts', function() {
      var rawDoc = {
        metadata: [
          { name: 'title', value: 'Test' }
        ]
      };
      var doc = makeDoc(rawDoc);
      var orig = doc.origin();

      expect(orig.title).toEqual('Test');
      expect(orig.doc).toBeUndefined();
      expect(orig.metadata).toBeUndefined();
      expect(orig.opts).toBeUndefined();
    });
  });

  describe('explain', function() {

    it('returns empty object (not implemented)', function() {
      var rawDoc = { metadata: [] };
      var doc = makeDoc(rawDoc);

      expect(doc.explain()).toEqual({});
    });
  });

  describe('snippet', function() {

    it('returns null (not implemented)', function() {
      var rawDoc = { metadata: [] };
      var doc = makeDoc(rawDoc);

      expect(doc.snippet()).toBeNull();
    });
  });

  describe('highlight', function() {

    it('returns null (not implemented)', function() {
      var rawDoc = { metadata: [] };
      var doc = makeDoc(rawDoc);

      expect(doc.highlight()).toBeNull();
    });
  });

  describe('_url', function() {

    it('returns unavailable', function() {
      var rawDoc = { metadata: [] };
      var doc = makeDoc(rawDoc);

      expect(doc._url()).toEqual('unavailable');
    });
  });
});

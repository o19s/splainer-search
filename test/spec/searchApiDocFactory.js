'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Factory: SearchApiDocFactory', function () {

  beforeEach(module('o19s.splainer-search'));

  var SearchApiDocFactory;

  beforeEach(inject(function (_SearchApiDocFactory_) {
    SearchApiDocFactory = _SearchApiDocFactory_;
  }));

  it('should be defined', function () {
    expect(SearchApiDocFactory).toBeDefined();
  });

  var makeDoc = function(rawDoc, options) {
    options = options || {};
    return new SearchApiDocFactory(rawDoc, options);
  };

  describe('field extraction', function() {

    it('copies fields from doc to instance', function() {
      var rawDoc = {
        _source: { title: 'Test', author: 'John' },
        id: '123'
      };
      var doc = makeDoc(rawDoc);

      // SearchApiDocFactory uses fieldsProperty which returns self
      // so the fields from the raw doc should be accessible
      expect(doc.id).toEqual('123');
    });

    it('flattens single-element arrays', function() {
      var rawDoc = {
        title: ['Only Title'],
        tags: ['tag1', 'tag2']
      };
      var doc = makeDoc(rawDoc);

      expect(doc.title).toEqual('Only Title');
      expect(doc.tags).toEqual(['tag1', 'tag2']);
    });

    it('handles null field values', function() {
      var rawDoc = {
        title: null,
        desc: 'OK'
      };
      var doc = makeDoc(rawDoc);

      expect(doc.title).toBeNull();
      expect(doc.desc).toEqual('OK');
    });
  });

  describe('origin', function() {

    it('returns non-function properties excluding doc', function() {
      var rawDoc = { id: '1', title: 'Test' };
      var doc = makeDoc(rawDoc);
      var orig = doc.origin();

      expect(orig.id).toEqual('1');
      expect(orig.title).toEqual('Test');
      expect(orig.doc).toBeUndefined();
    });
  });

  describe('explain', function() {

    it('returns empty object (not implemented)', function() {
      var doc = makeDoc({ id: '1' });
      expect(doc.explain()).toEqual({});
    });
  });

  describe('snippet', function() {

    it('returns null (not implemented)', function() {
      var doc = makeDoc({ id: '1' });
      expect(doc.snippet()).toBeNull();
    });
  });

  describe('highlight', function() {

    it('returns null (not implemented)', function() {
      var doc = makeDoc({ id: '1' });
      expect(doc.highlight()).toBeNull();
    });
  });

  describe('_url', function() {

    it('returns null (not implemented)', function() {
      var doc = makeDoc({ id: '1' });
      expect(doc._url()).toBeNull();
    });
  });
});

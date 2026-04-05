import { describe, it, expect, beforeEach } from 'vitest';
import { getNormalDocsSvc, getFieldSpecSvc } from './helpers/serviceFactory.js';

describe('normalDocsSvc', () => {
  var normalDocsSvc, fieldSpecSvc;

  beforeEach(() => {
    normalDocsSvc = getNormalDocsSvc();
    fieldSpecSvc = getFieldSpecSvc();
  });

  var mockDoc = function(origin, options) {
    options = options || {};
    return {
      origin: function() { return origin; },
      explain: function() { return options.explainJson || null; },
      highlight: function() { return null; },
      _url: function() { return 'http://example.com'; }
    };
  };

  var mockDocWithHighlight = function(origin, hlDict) {
    return {
      origin: function() { return origin; },
      explain: function() { return null; },
      highlight: function(docId, fieldName, pre, post) {
        if (hlDict && hlDict[fieldName]) {
          return hlDict[fieldName];
        }
        return null;
      },
      _url: function() { return 'http://example.com'; }
    };
  };

  describe('createNormalDoc', () => {
    it('assigns id, title, and subs from fieldSpec', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:myTitle sub:description');
      var origin = { myId: '123', myTitle: 'Test Title', description: 'Some text' };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(normalDoc.id).toEqual('123');
      expect(normalDoc.title).toEqual('Test Title');
      expect(normalDoc.subs.description).toEqual('Some text');
    });

    it('assigns thumb and image fields', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId thumb:thumbUrl image:imageUrl');
      var origin = { myId: '1', thumbUrl: 'http://thumb.jpg', imageUrl: 'http://image.jpg' };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(normalDoc.thumb).toEqual('http://thumb.jpg');
      expect(normalDoc.image).toEqual('http://image.jpg');
      expect(normalDoc.hasThumb()).toBe(true);
      expect(normalDoc.hasImage()).toBe(true);
    });

    it('reports hasThumb/hasImage as false when not present', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:myTitle');
      var origin = { myId: '1', myTitle: 'Test' };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(normalDoc.hasThumb()).toBe(false);
      expect(normalDoc.hasImage()).toBe(false);
    });

    it('converts field values to strings', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:myTitle');
      var origin = { myId: 42, myTitle: true };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(normalDoc.id).toEqual('42');
      expect(normalDoc.title).toEqual('true');
    });

    it('populates subsList array from subs', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId sub:a sub:b');
      var origin = { myId: '1', a: 'val_a', b: 'val_b' };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(normalDoc.subsList.length).toEqual(2);
      var fieldNames = normalDoc.subsList.map(function(s) { return s.field; });
      expect(fieldNames).toContain('a');
      expect(fieldNames).toContain('b');
    });

    it('handles wildcard subs (*) by including all fields except id/title/thumb/image', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:myTitle sub:*');
      var origin = { myId: '1', myTitle: 'Test', extra1: 'foo', extra2: 'bar' };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(normalDoc.subs.extra1).toEqual('foo');
      expect(normalDoc.subs.extra2).toEqual('bar');
      expect(normalDoc.subs.myId).toBeUndefined();
      expect(normalDoc.subs.myTitle).toBeUndefined();
    });

    it('skips missing sub fields gracefully', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId sub:exists sub:missing');
      var origin = { myId: '1', exists: 'here' };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(normalDoc.subs.exists).toEqual('here');
      expect(normalDoc.subs.missing).toBeUndefined();
    });

    it('handles object sub values by keeping them as objects', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId sub:nested');
      var origin = { myId: '1', nested: { a: 1, b: 2 } };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(typeof normalDoc.subs.nested).toEqual('object');
      expect(normalDoc.subs.nested.a).toEqual(1);
    });
  });

  describe('dot-notation field access', () => {
    it('traverses nested objects with dot notation', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:meta.title');
      var origin = { myId: '1', meta: { title: 'Nested Title' } };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(normalDoc.title).toEqual('Nested Title');
    });

    it('prefers literal dot-containing property over nested traversal', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:a.b');
      var origin = { myId: '1', 'a.b': 'literal', a: { b: 'nested' } };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(normalDoc.title).toEqual('literal');
    });

    it('handles deeply nested dot notation', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:a.b.c');
      var origin = { myId: '1', a: { b: { c: 'deep' } } };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(normalDoc.title).toEqual('deep');
    });

    it('handles dot notation in sub fields', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId sub:meta.desc');
      var origin = { myId: '1', meta: { desc: 'nested sub' } };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(normalDoc.subs['meta.desc']).toEqual('nested sub');
    });

    it('uses empty string for missing nested value instead of "undefined"', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:a.b.missing');
      var origin = { myId: '1', a: { b: {} } };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(normalDoc.title).toEqual('');
    });
  });

  describe('snippitable (highlight features)', () => {
    it('returns highlighted title when available', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:myTitle');
      var origin = { myId: '1', myTitle: 'Test Title' };
      var hlDict = { myTitle: '<b>Test</b> Title' };
      var doc = mockDocWithHighlight(origin, hlDict);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      var hlTitle = normalDoc.getHighlightedTitle('<b>', '</b>');
      expect(hlTitle).toEqual('<b>Test</b> Title');
    });

    it('falls back to escaped snippet when no highlight found for title', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:myTitle');
      var origin = { myId: '1', myTitle: 'Plain Title' };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      var result = normalDoc.getHighlightedTitle('<b>', '</b>');
      expect(result).toContain('Plain Title');
    });

    it('returns sub snippets as a map', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId sub:desc');
      var origin = { myId: '1', desc: 'Some long description text' };
      var hlDict = { desc: '<em>Some</em> long description text' };
      var doc = mockDocWithHighlight(origin, hlDict);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      var snips = normalDoc.subSnippets('<em>', '</em>');
      expect(snips.desc).toEqual('<em>Some</em> long description text');
    });

    it('caches sub snippets when hlPre/hlPost unchanged', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId sub:desc');
      var origin = { myId: '1', desc: 'text' };
      var doc = mockDocWithHighlight(origin, {});
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      var snips1 = normalDoc.subSnippets('<b>', '</b>');
      var snips2 = normalDoc.subSnippets('<b>', '</b>');
      expect(snips1).toBe(snips2);
    });
  });

  describe('explainable (explain features)', () => {
    it('lazily initializes explain', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:myTitle');
      var origin = { myId: '1', myTitle: 'Test' };
      var explainJson = {
        value: 1.5, description: 'sum of',
        details: [
          { value: 0.5, description: 'part 1', details: [] },
          { value: 1.0, description: 'part 2', details: [] }
        ]
      };
      var doc = mockDoc(origin, { explainJson: explainJson });
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc, explainJson);
      expect(normalDoc.score()).toBeCloseTo(1.5, 1);
    });

    it('returns hot matches from explain', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:myTitle');
      var origin = { myId: '1', myTitle: 'Test' };
      var explainJson = {
        value: 2.0, description: 'sum of',
        details: [
          { value: 1.2, description: 'match A', details: [] },
          { value: 0.8, description: 'match B', details: [] }
        ]
      };
      var doc = mockDoc(origin, { explainJson: explainJson });
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc, explainJson);
      var hotMatches = normalDoc.hotMatches();
      expect(hotMatches).toBeDefined();
      expect(hotMatches.vecObj).toBeDefined();
    });

    it('returns hotMatchesOutOf sorted by percentage', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:myTitle');
      var origin = { myId: '1', myTitle: 'Test' };
      var explainJson = {
        value: 3.0, description: 'sum of',
        details: [
          { value: 1.0, description: 'match A', details: [] },
          { value: 2.0, description: 'match B', details: [] }
        ]
      };
      var doc = mockDoc(origin, { explainJson: explainJson });
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc, explainJson);
      var hotOutOf = normalDoc.hotMatchesOutOf(3.0);
      expect(hotOutOf.length).toBeGreaterThan(0);
      for (var i = 1; i < hotOutOf.length; i++) {
        expect(hotOutOf[i-1].percentage).toBeGreaterThanOrEqual(hotOutOf[i].percentage);
      }
    });
  });

  describe('createPlaceholderDoc', () => {
    it('creates a placeholder with id and title', () => {
      var placeholder = normalDocsSvc.createPlaceholderDoc('doc123', 'Missing Doc');
      expect(placeholder.id).toEqual('doc123');
      expect(placeholder.title).toEqual('Missing Doc');
    });

    it('placeholder without explain has stub subSnippets', () => {
      var placeholder = normalDocsSvc.createPlaceholderDoc('doc123', 'Missing');
      expect(placeholder.subSnippets()).toEqual('');
    });

    it('placeholder with explain gets explain features', () => {
      var explainJson = { value: 1.0, description: 'test explain', details: [] };
      var placeholder = normalDocsSvc.createPlaceholderDoc('doc123', 'Missing', explainJson);
      expect(placeholder.score()).toBeCloseTo(1.0, 1);
    });
  });

  describe('explainDoc and snippetDoc', () => {
    it('explainDoc decorates doc with explain methods', () => {
      var doc = { id: '1', title: 'test', subs: {} };
      var explainJson = { value: 2.5, description: 'test', details: [] };
      var result = normalDocsSvc.explainDoc(doc, explainJson);
      expect(result.explain).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.hotMatches).toBeDefined();
      expect(result.hotMatchesOutOf).toBeDefined();
      expect(result.matchDetails).toBeDefined();
    });

    it('snippetDoc decorates doc with snippet methods', () => {
      var doc = { id: '1', title: 'test', subs: {}, doc: mockDoc({}) };
      var result = normalDocsSvc.snippetDoc(doc);
      expect(result.subSnippets).toBeDefined();
      expect(result.getHighlightedTitle).toBeDefined();
    });
  });
});

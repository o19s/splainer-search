import { describe, it, expect, beforeEach } from 'vitest';
import { getNormalDocsSvc, getFieldSpecSvc } from './helpers/serviceFactory.js';

describe('normalDocsSvc', () => {
  var normalDocsSvc, fieldSpecSvc;

  beforeEach(() => {
    normalDocsSvc = getNormalDocsSvc();
    fieldSpecSvc = getFieldSpecSvc();
  });

  var mockDoc = function (origin, options) {
    options = options || {};
    return {
      origin: function () {
        return origin;
      },
      explain: function () {
        return options.explainJson || null;
      },
      highlight: function () {
        return null;
      },
      _url: function () {
        return 'http://example.com';
      },
    };
  };

  var mockDocWithHighlight = function (origin, hlDict) {
    return {
      origin: function () {
        return origin;
      },
      explain: function () {
        return null;
      },
      highlight: function (docId, fieldName, _pre, _post) {
        if (hlDict && hlDict[fieldName]) {
          return hlDict[fieldName];
        }
        return null;
      },
      _url: function () {
        return 'http://example.com';
      },
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
      var fieldNames = normalDoc.subsList.map(function (s) {
        return s.field;
      });
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
        value: 1.5,
        description: 'sum of',
        details: [
          { value: 0.5, description: 'part 1', details: [] },
          { value: 1.0, description: 'part 2', details: [] },
        ],
      };
      var doc = mockDoc(origin, { explainJson: explainJson });
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc, explainJson);
      expect(normalDoc.score()).toBeCloseTo(1.5, 1);
    });

    it('returns hot matches from explain', () => {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:myTitle');
      var origin = { myId: '1', myTitle: 'Test' };
      var explainJson = {
        value: 2.0,
        description: 'sum of',
        details: [
          { value: 1.2, description: 'match A', details: [] },
          { value: 0.8, description: 'match B', details: [] },
        ],
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
        value: 3.0,
        description: 'sum of',
        details: [
          { value: 1.0, description: 'match A', details: [] },
          { value: 2.0, description: 'match B', details: [] },
        ],
      };
      var doc = mockDoc(origin, { explainJson: explainJson });
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc, explainJson);
      var hotOutOf = normalDoc.hotMatchesOutOf(3.0);
      expect(hotOutOf.length).toBeGreaterThan(0);
      for (var i = 1; i < hotOutOf.length; i++) {
        expect(hotOutOf[i - 1].percentage).toBeGreaterThanOrEqual(hotOutOf[i].percentage);
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

    it('decorated doc is the same object reference (identity)', () => {
      var fieldSpec = { id: 'myId', title: 'myTitle' };
      var origin = { myId: '1', myTitle: 'Test' };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      var explainJson = { value: 0.5, description: 'weight(text:order in 1234)', details: [] };
      var decoratedDoc = normalDocsSvc.explainDoc(normalDoc, explainJson);
      expect(decoratedDoc).toBe(normalDoc);
    });
  });

  describe('_url delegation', () => {
    it('passes the id field name and value to the underlying doc._url', () => {
      var lastFieldName = null;
      var lastFieldValue = null;
      var solrDoc = {
        custom_id_field: '1234',
        title_field: 'a title',
        origin: function () {
          return this;
        },
        _url: function (fieldName, fieldValue) {
          lastFieldName = fieldName;
          lastFieldValue = fieldValue;
        },
        explain: function () {
          return null;
        },
        highlight: function () {
          return null;
        },
      };
      var fieldSpec = { id: 'custom_id_field', title: 'title_field' };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      normalDoc._url();
      expect(lastFieldName).toEqual('custom_id_field');
      expect(lastFieldValue).toEqual('1234');
    });
  });

  describe('integer field handling', () => {
    it('converts integer sub values to strings', () => {
      var fieldSpec = { id: 'myId', title: 'myTitle', subs: ['int_field'] };
      var origin = { myId: '1', myTitle: 'Title', int_field: 1234 };
      var doc = mockDoc(origin);
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
      expect(normalDoc.subs.int_field).toEqual('1234');
    });
  });

  describe('HTML escaping', () => {
    it('escapes HTML in sub snippets when no highlights are available', () => {
      var origin = { myId: '1', myTitle: 'a title', another_field: '<blah>another_value</blah>' };
      var solrDoc = {
        origin: function () {
          return origin;
        },
        explain: function () {
          return null;
        },
        highlight: function () {
          return null;
        },
        _url: function () {
          return '';
        },
      };
      var fieldSpec = { id: 'myId', title: 'myTitle', subs: ['another_field'] };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subSnippets().another_field).toContain('&gt;');
      expect(normalDoc.subSnippets().another_field).toContain('&lt;');
    });
  });

  describe('highlight integration', () => {
    it('ignores highlights for title but uses them for sub fields', () => {
      var availableHighlight = 'something';
      var origin = { myId: '1', title_field: 'a title', another_field: 'another_value' };
      var solrDoc = {
        origin: function () {
          return origin;
        },
        explain: function () {
          return null;
        },
        highlight: function (ign, ign2, pre, post) {
          return pre + availableHighlight + post;
        },
        _url: function () {
          return '';
        },
      };
      var fieldSpec = { id: 'myId', title: 'title_field', subs: ['another_field'] };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      // Title stays as the raw field value, not highlighted
      expect(normalDoc.title).toEqual('a title');
      expect(normalDoc.subs.another_field).toEqual('another_value');
      // Sub snippets use highlights
      var snips = normalDoc.subSnippets('<b>', '</b>');
      expect(snips.another_field).toEqual('<b>' + availableHighlight + '</b>');
    });

    it('uses original value when highlight returns null', () => {
      var origin = { myId: '1', title_field: 'a title', another_field: 'another_value' };
      var solrDoc = {
        origin: function () {
          return origin;
        },
        explain: function () {
          return null;
        },
        highlight: function () {
          return null;
        },
        _url: function () {
          return '';
        },
      };
      var fieldSpec = { id: 'myId', title: 'title_field', subs: ['another_field'] };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs.another_field).toEqual('another_value');
    });
  });

  describe('explain edge cases', () => {
    it('uses stub explain when doc.explain() returns null', () => {
      var fieldSpec = { id: 'myId', title: 'myTitle' };
      var origin = { myId: '1', myTitle: 'Test' };
      var solrDoc = {
        origin: function () {
          return origin;
        },
        explain: function () {
          return null;
        },
        highlight: function () {
          return null;
        },
        url: function () {
          return 'http://127.0.0.1';
        },
        _url: function () {
          return '';
        },
      };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.explain().explanation()).toContain('no explain');
      expect(normalDoc.explain().contribution()).toBe(0.0);
    });

    it('uses alt explain passed as third argument to createNormalDoc', () => {
      var fieldSpec = { id: 'myId', title: 'myTitle' };
      var origin = { myId: '1', myTitle: 'Test' };
      var altExplain = {
        match: true,
        value: 0.5,
        description: 'weight(text:order in 1234)',
        details: [],
      };
      var solrDoc = {
        origin: function () {
          return origin;
        },
        explain: function () {
          return null;
        },
        highlight: function () {
          return null;
        },
        _url: function () {
          return '';
        },
      };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc, altExplain);
      var hmOutOf = normalDoc.hotMatchesOutOf(1.0);
      expect(hmOutOf.length).toBe(1);
      expect(hmOutOf[0].description).toContain('order');
      expect(hmOutOf[0].percentage).toBe(50.0);
      expect(normalDoc.explain().explanation()).toContain('order');
    });

    it('falls back to doc.origin().id when custom id field explain lookup returns null', () => {
      var fieldSpec = { id: 'custom_id_field', title: 'title_field' };
      var basicExplain1 = {
        match: true,
        value: 1.5,
        description: 'weight(text:law in 1234)',
        details: [],
      };
      var basicExplain2 = {
        match: true,
        value: 0.5,
        description: 'weight(text:order in 1234)',
        details: [],
      };
      var sumExplain = {
        match: true,
        value: 1.0,
        description: 'sum of',
        details: [basicExplain1, basicExplain2],
      };
      var idVals = [];
      var solrDoc = {
        custom_id_field: '1234',
        title_field: 'a title',
        id: 'solrs_actual_id',
        origin: function () {
          return this;
        },
        explain: function (idVal) {
          idVals.push(idVal);
          if (idVal === 'solrs_actual_id') {
            return sumExplain;
          }
          return null;
        },
        highlight: function () {
          return null;
        },
        _url: function () {
          return '';
        },
      };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(idVals.length).toBe(2);
      expect(idVals[0]).toEqual('1234');
      expect(idVals[1]).toEqual('solrs_actual_id');
      expect(normalDoc.score()).toEqual(1.0);
    });
  });

  describe('uses origin() not direct fields', () => {
    it('reads id, title, and subs from origin() return value', () => {
      var idFromSrc = '5555';
      var titleFromSrc = 'src title';
      var sub1FromSrc = 'srcsub1_val';
      var sub2FromSrc = 'srcsub2_val';
      var solrDoc = {
        custom_id_field: '1234',
        title_field: 'a title',
        sub1: 'sub1_val',
        sub2: 'sub2_val',
        origin: function () {
          return {
            custom_id_field: idFromSrc,
            title_field: titleFromSrc,
            sub1: sub1FromSrc,
            sub2: sub2FromSrc,
          };
        },
        explain: function () {
          return null;
        },
        highlight: function () {
          return null;
        },
        _url: function () {
          return '';
        },
      };
      var fieldSpec = { id: 'custom_id_field', title: 'title_field', subs: '*' };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(Object.keys(normalDoc.subs).length).toEqual(2);
      expect(normalDoc.id).toEqual(idFromSrc);
      expect(normalDoc.title).toEqual(titleFromSrc);
      expect(normalDoc.subs.sub1).toEqual(sub1FromSrc);
      expect(normalDoc.subs.sub2).toEqual(sub2FromSrc);
    });
  });

  describe('wildcard subs with functions', () => {
    var makeSolrDoc = function (fields) {
      var merged = Object.assign(
        {
          origin: function () {
            return this;
          },
          explain: function () {
            return null;
          },
          highlight: function () {
            return null;
          },
          _url: function () {
            return '';
          },
        },
        fields,
      );
      return merged;
    };

    it('works with an empty title', () => {
      var solrDoc = makeSolrDoc({ custom_id_field: '1234', 'actor.name': 'Harrison Ford' });
      var fieldSpec = { id: 'custom_id_field', title: null, subs: ['actor.name'] };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.getHighlightedTitle('', '')).toEqual(null);
    });

    it('captures function values as subs', () => {
      var solrDoc = makeSolrDoc({
        custom_id_field: '1234',
        title_field: 'a title',
        sub2: 'sub2_val',
        fn: 2.0,
      });
      var fieldSpec = {
        id: 'custom_id_field',
        title: 'title_field',
        subs: ['sub2'],
        functions: ['fn:$fn'],
      };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(Object.keys(normalDoc.subs).length).toEqual(2);
      expect(normalDoc.subs.sub2).toEqual('sub2_val');
      expect(normalDoc.subs.fn).toEqual('2');
    });

    it('captures function values with wildcard subs', () => {
      var solrDoc = makeSolrDoc({
        custom_id_field: '1234',
        title_field: 'a title',
        sub1: 'sub1_val',
        sub2: 'sub2_val',
        fn: 2.0,
      });
      var fieldSpec = {
        id: 'custom_id_field',
        title: 'title_field',
        subs: '*',
        functions: ['fn:$fn'],
      };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(Object.keys(normalDoc.subs).length).toEqual(3);
      expect(normalDoc.subs.sub1).toEqual('sub1_val');
      expect(normalDoc.subs.sub2).toEqual('sub2_val');
      expect(normalDoc.subs.fn).toEqual('2');
    });

    it('captures wildcard sub values with highlights', () => {
      var highlights = { sub1: 'sub1_hl' };
      var solrDoc = {
        custom_id_field: '1234',
        title_field: 'a title',
        sub1: 'sub1_val',
        sub2: 'sub2_val',
        fn: 2.0,
        origin: function () {
          return this;
        },
        explain: function () {
          return null;
        },
        highlight: function (docId, field, pre, post) {
          if (highlights[field]) {
            return pre + highlights[field] + post;
          }
          return null;
        },
        _url: function () {
          return '';
        },
      };
      var fieldSpec = { id: 'custom_id_field', title: 'title_field', subs: '*' };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(Object.keys(normalDoc.subs).length).toEqual(3);
      expect(normalDoc.subs.sub1).toEqual('sub1_val');
      expect(normalDoc.subs.sub2).toEqual('sub2_val');
      expect(normalDoc.subSnippets('<b>', '</b>').sub1).toEqual('<b>sub1_hl</b>');
      expect(normalDoc.subSnippets('<b>', '</b>').sub2).toEqual('sub2_val');
    });
  });

  describe('dot notation edge cases', () => {
    var makeSolrDoc = function (fields) {
      return Object.assign(
        {
          origin: function () {
            return this;
          },
          explain: function () {
            return null;
          },
          highlight: function () {
            return null;
          },
          _url: function () {
            return '';
          },
        },
        fields,
      );
    };

    it('captures sub values with dot notation in an array', () => {
      var solrDoc = makeSolrDoc({
        id: '1234',
        title_field: 'a title',
        genres: [
          { name: 'Action', id: 1 },
          { name: 'Comedy', id: 2 },
        ],
      });
      var fieldSpec = { id: 'id', title: 'title_field', subs: ['genres.name'] };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs['genres.name']).toEqual(['Action', 'Comedy']);
    });

    it('captures sub values with dot notation in both an array and a dictionary', () => {
      var solrDoc = makeSolrDoc({
        id: '1234',
        title_field: 'a title',
        nesting: {
          genres: [
            { name: 'Action', id: 1 },
            { name: 'Comedy', id: 2 },
          ],
        },
      });
      var fieldSpec = { id: 'id', title: 'title_field', subs: ['nesting.genres.name'] };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs['nesting.genres.name']).toEqual(['Action', 'Comedy']);
    });

    it('captures sub values when the field name has a dot in it (not dot notation)', () => {
      var solrDoc = makeSolrDoc({
        id: '1234',
        title_field: 'a title',
        'actor.name': 'Harrison Ford',
      });
      var fieldSpec = { id: 'id', title: 'title_field', subs: ['actor.name'] };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs['actor.name']).toEqual('Harrison Ford');
    });

    it('captures sub values with dot notation into nested object', () => {
      var solrDoc = makeSolrDoc({
        id: '1234',
        title_field: 'a title',
        director: { credit_id: '52fe44fac3a36847f80b56e7', name: 'Robert Clouse' },
      });
      var fieldSpec = { id: 'id', title: 'title_field', subs: ['director.name'] };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs['director.name']).toEqual('Robert Clouse');
    });
  });

  describe('field spec options (image/thumb)', () => {
    var makeSolrDoc = function (fields) {
      return Object.assign(
        {
          origin: function () {
            return this;
          },
          explain: function () {
            return null;
          },
          highlight: function () {
            return null;
          },
          _url: function () {
            return '';
          },
        },
        fields,
      );
    };

    it('handles image_options from fieldSpec', () => {
      var solrDoc = makeSolrDoc({
        id: '1234',
        title_field: 'a title',
        relative_image: '/some/image.png',
      });
      var fieldSpec = {
        id: 'id',
        title: 'title_field',
        subs: ['relative_image'],
        image: 'relative_image',
        image_options: { prefix: 'http://example.org/' },
      };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs['relative_image']).toEqual('/some/image.png');
      expect(normalDoc.image).toEqual('/some/image.png');
      expect(normalDoc.hasImage()).toBe(true);
      expect(normalDoc.image_options).toEqual({ prefix: 'http://example.org/' });
    });

    it('handles thumb_options from fieldSpec', () => {
      var solrDoc = makeSolrDoc({
        id: '1234',
        title_field: 'a title',
        relative_image: '/some/image.png',
      });
      var fieldSpec = {
        id: 'id',
        title: 'title_field',
        subs: ['relative_image'],
        thumb: 'relative_image',
        thumb_options: { prefix: 'http://example.org/thumbs/' },
      };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs['relative_image']).toEqual('/some/image.png');
      expect(normalDoc.thumb).toEqual('/some/image.png');
      expect(normalDoc.hasImage()).toBe(false);
      expect(normalDoc.hasThumb()).toBe(true);
      expect(normalDoc.thumb_options).toEqual({ prefix: 'http://example.org/thumbs/' });
    });
  });
});

'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Factory: SolrDocFactory', function () {

  beforeEach(module('o19s.splainer-search'));

  var SolrDocFactory;

  beforeEach(inject(function (_SolrDocFactory_) {
    SolrDocFactory = _SolrDocFactory_;
  }));

  it('should be defined', function () {
    expect(SolrDocFactory).toBeDefined();
  });

  var makeDoc = function(rawDoc, options) {
    var defaults = {
      url: 'http://localhost:8983/solr/collection1/select',
      explDict: {},
      hlDict: {},
      fieldList: '*',
      highlightingPre: 'em',
      highlightingPost: '/em'
    };
    options = Object.assign(defaults, options || {});
    return new SolrDocFactory(rawDoc, options);
  };

  describe('origin', function() {

    it('returns a copy of the original doc', function() {
      var rawDoc = { id: '123', title: 'Test Doc', score: 1.5 };
      var doc = makeDoc(rawDoc);

      var orig = doc.origin();
      expect(orig.id).toEqual('123');
      expect(orig.title).toEqual('Test Doc');
    });

    it('returns a copy, not the original reference', function() {
      var rawDoc = { id: '123', title: 'Original' };
      var doc = makeDoc(rawDoc);

      var orig = doc.origin();
      orig.title = 'Modified';
      expect(doc.origin().title).toEqual('Original');
    });
  });

  describe('explain', function() {

    it('returns explain json for known doc id', function() {
      var explDict = { '123': { value: 2.5, description: 'test' } };
      var doc = makeDoc({ id: '123' }, { explDict: explDict });

      var expl = doc.explain('123');
      expect(expl.value).toEqual(2.5);
    });

    it('returns null for unknown doc id', function() {
      var doc = makeDoc({ id: '123' }, { explDict: {} });

      expect(doc.explain('999')).toBeNull();
    });
  });

  describe('snippet', function() {

    it('returns highlight for known doc and field', function() {
      var hlDict = {
        '123': { title: ['<em>Test</em> Doc'] }
      };
      var doc = makeDoc({ id: '123' }, { hlDict: hlDict });

      var snip = doc.snippet('123', 'title');
      expect(snip).toEqual(['<em>Test</em> Doc']);
    });

    it('returns null when no highlights exist for doc', function() {
      var doc = makeDoc({ id: '123' }, { hlDict: {} });

      expect(doc.snippet('123', 'title')).toBeNull();
    });

    it('returns null when field not in highlights', function() {
      var hlDict = { '123': { title: ['highlighted'] } };
      var doc = makeDoc({ id: '123' }, { hlDict: hlDict });

      expect(doc.snippet('123', 'missing_field')).toBeNull();
    });
  });

  describe('highlight', function() {

    it('replaces highlight pre/post tags in string values', function() {
      // Solr's highlight function escapes HTML first, then does regex replacement.
      // So the highlightingPre/Post patterns must match the *escaped* text.
      // Using patterns that survive escapeHtml:
      var hlDict = {
        'doc1': { title: 'HLPRE matched HLPOST text' }
      };
      var doc = makeDoc({ id: 'doc1' }, {
        hlDict: hlDict,
        highlightingPre: 'HLPRE',
        highlightingPost: 'HLPOST'
      });

      var result = doc.highlight('doc1', 'title', '<b>', '</b>');
      expect(result).toContain('<b>');
      expect(result).toContain('</b>');
      expect(result).toContain('matched');
    });

    it('handles array highlight values', function() {
      var hlDict = {
        'doc1': { desc: ['HLPRE first HLPOST', 'HLPRE second HLPOST'] }
      };
      var doc = makeDoc({ id: 'doc1' }, {
        hlDict: hlDict,
        highlightingPre: 'HLPRE',
        highlightingPost: 'HLPOST'
      });

      var result = doc.highlight('doc1', 'desc', '<b>', '</b>');
      expect(result instanceof Array).toBe(true);
      expect(result.length).toEqual(2);
    });

    it('returns null when no highlight exists', function() {
      var doc = makeDoc({ id: 'doc1' }, { hlDict: {} });

      expect(doc.highlight('doc1', 'title', '<b>', '</b>')).toBeNull();
    });

    it('returns null for empty array highlights', function() {
      var hlDict = { 'doc1': { title: [] } };
      var doc = makeDoc({ id: 'doc1' }, { hlDict: hlDict });

      expect(doc.highlight('doc1', 'title', '<b>', '</b>')).toBeNull();
    });

    it('escapes HTML entities in highlight values', function() {
      var hlDict = {
        'doc1': { title: 'HLPRE <script>alert("xss")</script> HLPOST' }
      };
      var doc = makeDoc({ id: 'doc1' }, {
        hlDict: hlDict,
        highlightingPre: 'HLPRE',
        highlightingPost: 'HLPOST'
      });

      var result = doc.highlight('doc1', 'title', '<b>', '</b>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('treats highlight pre/post markers as literal text (regex metacharacters)', function() {
      var hlDict = {
        'doc1': { title: 'H(LPRE matched HLPOST text' }
      };
      var doc = makeDoc({ id: 'doc1' }, {
        hlDict: hlDict,
        highlightingPre: 'H(LPRE',
        highlightingPost: 'HLPOST'
      });

      var result = doc.highlight('doc1', 'title', '<b>', '</b>');
      expect(result).toContain('<b>');
      expect(result).toContain('matched');
    });
  });

  describe('_url', function() {

    it('builds a Solr document URL', function() {
      var doc = makeDoc({ id: 'doc1' }, {
        url: 'http://localhost:8983/solr/collection1/select',
        fieldList: '*'
      });

      var url = doc._url('id', 'doc1');
      expect(url).toContain('http://localhost:8983/solr/collection1/select');
      expect(url).toContain('q=id:doc1');
      expect(url).toContain('wt=json');
    });

    it('encodes special characters in doc id', function() {
      var doc = makeDoc({ id: 'doc with spaces' }, {
        url: 'http://localhost:8983/solr/collection1/select'
      });

      var url = doc._url('id', 'doc with spaces');
      expect(url).toContain('doc%20with%20spaces');
    });
  });
});

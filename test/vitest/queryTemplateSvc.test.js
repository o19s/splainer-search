import { describe, it, expect } from 'vitest';
import { queryTemplateSvcConstructor } from '../../services/queryTemplateSvc.js';

function createQueryTemplateSvc() {
  return new queryTemplateSvcConstructor();
}

describe('queryTemplateSvc', () => {
  describe('parse query template', () => {
    it('parses solr style GET params correctly', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var queryText = 'rambo movie';
      var template  = { "query": "#$query##" };
      template = JSON.stringify(template);

      var replaced = queryTemplateSvc.hydrate(template, queryText, {encodeURI: false, defaultKw: '\\"\\"'});
      replaced = JSON.parse(replaced);

      var expectedReplaced = { query: "rambo movie" };
      expect(replaced).toEqual(expectedReplaced);
    });

    it('replaces hierarchically in query objects and passes through types of values', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var queryText = 'rambo movie';

      var qOption = {
        customerId: 123456789,
        corpusId: 1,
        dims: [
          { name: "customDim1", weight: 0.8 },
          { name: "customDim2", weight: 0.6 }
        ]
      };

      var template = {
        "query": [
          {
            "query": "#$query##",
            "start": 0,
            "numResults": 10,
            "corpusKey": [{
              "customerId": "#$qOption.customerId##",
              "corpusId": "#$qOption.corpusId##",
              "lexicalInterpolationConfig": { "lambda": 0.025 },
              "dim": "#$qOption.dims##"
            }]
          }
        ]
      };

      var replaced = queryTemplateSvc.hydrate(template, queryText, {qOption: qOption, encodeURI: false, defaultKw: '\\"\\"'});

      var expectedReplaced = {
        "query": [
          {
            "query": "rambo movie",
            "start": 0,
            "numResults": 10,
            "corpusKey": [{
              "customerId": 123456789,
              "corpusId": 1,
              "lexicalInterpolationConfig": { "lambda": 0.025 },
              "dim": [{ name: "customDim1", weight: 0.8 }, { name: "customDim2", weight: 0.6 }]
            }]
          }
        ]
      };

      expect(replaced).toEqual(expectedReplaced);
    });

    it('passes through arrays', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      const queryText = "test query";
      const qOption = {
        "complexDoc": { "doc_id": 1, "prefix": "doc" }
      };
      const template = {
        "query": {
          "query": "#$query##",
          "docs": ["#$qOption.complexDoc##", "doc2", "doc3"]
        }
      };
      const replaced = queryTemplateSvc.hydrate(template, queryText, { qOption: qOption, encodeURI: false, defaultKw: '\\"\\"'});
      var expectedReplaced = {
        query: {
          query: "test query",
          docs: [ { "doc_id": 1, "prefix": "doc" }, "doc2", "doc3"]
        }
      };
      expect(replaced).toEqual(expectedReplaced);
    });

    it('leaves unresolved parameters untouched', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var queryText = 'rambo movie';

      var qOption = {
        category: 123456789,
        from: 10
      };

      var template = {
        "query": {
          "query": "#$query##",
          "filter": "filter: #$filter##",
          "size": "#$qOption.size##",
          "category": "#$qOption.category##",
          "sort": "#$qOption.sort|score##",
          "from": "from #$qOption.from##"
        },
        "other": {
          "param": "#$unknown.object.path##"
        }
      };

      var replaced = queryTemplateSvc.hydrate(template, queryText, {qOption: qOption, encodeURI: false, defaultKw: '\\"\\"'});

      var expectedReplaced = {
        "query": {
          "query": "rambo movie",
          "filter": "filter: #$filter##",
          "size": "#$qOption.size##",
          "category": 123456789,
          "sort": "score",
          "from": "from 10"
        },
        "other": {
          "param": "#$unknown.object.path##"
        }
      };

      expect(replaced).toEqual(expectedReplaced);
    });

    it('supports old keywords parameters, 0-index based array access and default values', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var queryText = 'rambo movie';
      var template = { "query": "#$keyword1## and #$keyword.1## and #$keyword3|other##" };
      template = JSON.stringify(template);

      var replaced = queryTemplateSvc.hydrate(template, queryText, {encodeURI: false, defaultKw: '\\"\\"'});
      replaced = JSON.parse(replaced);

      var expectedReplaced = { query: "rambo and movie and other" };
      expect(replaced).toEqual(expectedReplaced);
    });

    it('returns template unchanged when queryText is null', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var template = { query: '#$query##', filter: 'type:book' };
      var result = queryTemplateSvc.hydrate(template, null, { encodeURI: false });
      expect(result).toEqual(template);
    });

    it('returns template unchanged when queryText is undefined', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var template = { query: '#$query##' };
      var result = queryTemplateSvc.hydrate(template, undefined, { encodeURI: false });
      expect(result).toEqual(template);
    });

    it('handles default values in dot-notation placeholders', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var queryText = 'test';
      var template = {
        sort: '#$qOption.sortField|relevance##',
        limit: '#$qOption.limit|10##'
      };
      var config = { encodeURI: false, qOption: {} };
      var result = queryTemplateSvc.hydrate(template, queryText, config);
      expect(result.sort).toEqual('relevance');
      expect(result.limit).toEqual('10');
    });

    it('leaves placeholder when intermediate path segment is missing (default only works on leaf)', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var queryText = 'test';
      var template = { field: '#$qOption.missing.deep|fallback##' };
      var config = { encodeURI: false, qOption: { other: 'value' } };
      var result = queryTemplateSvc.hydrate(template, queryText, config);
      expect(result.field).toEqual('#$qOption.missing.deep|fallback##');
    });

    it('leaves unresolved placeholder when no default provided', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var queryText = 'test';
      var template = { field: '#$qOption.nonexistent##' };
      var config = { encodeURI: false, qOption: {} };
      var result = queryTemplateSvc.hydrate(template, queryText, config);
      expect(result.field).toEqual('#$qOption.nonexistent##');
    });

    it('uses default config when config is null', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var queryText = 'test';
      var template = { q: '#$query##' };
      var result = queryTemplateSvc.hydrate(template, queryText, null);
      expect(result.q).toEqual('test');
    });

    it('handles multi-word queryText with keyword replacement', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var queryText = 'one two three four';
      var template = {
        first: '#$keyword1##',
        second: '#$keyword2##',
        third: '#$keyword3##',
        fourth: '#$keyword4##',
        fifth: '#$keyword5|default##'
      };
      template = JSON.stringify(template);
      var result = queryTemplateSvc.hydrate(template, queryText, { encodeURI: false });
      result = JSON.parse(result);
      expect(result.first).toEqual('one');
      expect(result.second).toEqual('two');
      expect(result.third).toEqual('three');
      expect(result.fourth).toEqual('four');
      expect(result.fifth).toEqual('default');
    });

    it('encodes query text when encodeURI is true', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var queryText = 'hello world & more';
      var template = { q: '#$query##' };
      var result = queryTemplateSvc.hydrate(template, queryText, { encodeURI: true });
      expect(result.q).toEqual(encodeURIComponent('hello world & more'));
    });

    it('preserves numeric and boolean values in templates', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var queryText = 'test';
      var template = {
        query: '#$query##',
        rows: 10,
        debug: true,
        score: 0.5
      };
      var result = queryTemplateSvc.hydrate(template, queryText, { encodeURI: false });
      expect(result.rows).toBe(10);
      expect(result.debug).toBe(true);
      expect(result.score).toBe(0.5);
    });

    it('uses only the first pipe segment as default when the default literal contains additional pipes', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var queryText = 'test';
      var template = { note: '#$qOption.missing|a|b|c##' };
      var result = queryTemplateSvc.hydrate(template, queryText, { encodeURI: false, qOption: {} });
      expect(result.note).toEqual('a');
    });

    it('substitutes array-valued qOption properties at nested depth', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var queryText = 'q';
      var qOption = { items: ['alpha', 'beta'] };
      var template = {
        outer: {
          inner: ['#$qOption.items##', 'static']
        }
      };
      var result = queryTemplateSvc.hydrate(template, queryText, { encodeURI: false, qOption: qOption });
      expect(result.outer.inner[0]).toEqual(['alpha', 'beta']);
      expect(result.outer.inner[1]).toEqual('static');
    });
  });

  describe('hydrateSearchQuery', () => {
    it('returns object queryText unchanged when objectOverride is default', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var dsl = { query: { match_all: {} } };
      var args = { q: '#$query##' };
      var out = queryTemplateSvc.hydrateSearchQuery(null, args, dsl);
      expect(out).toBe(dsl);
    });

    it('escapes backslashes and quotes then hydrates string queryText', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var args = { q: '#$query##' };
      var out = queryTemplateSvc.hydrateSearchQuery({ foo: 1 }, args, 'a"b\\c');
      expect(out.q).toBe('a\\"b\\\\c');
    });

    it('with escapeQuery false, does not escape quotes in query string', () => {
      var queryTemplateSvc = createQueryTemplateSvc();
      var args = { q: '#$query##' };
      var out = queryTemplateSvc.hydrateSearchQuery(null, args, 'say "hi"', {
        objectOverride: false,
        escapeQuery: false,
      });
      expect(out.q).toBe('say "hi"');
    });
  });
});

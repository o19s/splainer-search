// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getSolrSearcherPreprocessorSvc } from './helpers/serviceFactory.js';
import { deepMerge } from './helpers/utilsSvcStub.js';

describe('solrSearcherPreprocessorSvc', () => {
  var solrSearcherPreprocessorSvc;

  // Use a fresh copy of defaultSolrConfig for each test (matches Karma $provide override)
  var freshDefaultConfig = {
    sanitize: true,
    highlight: true,
    debug: true,
    numberOfRows: 10,
    escapeQuery: true,
    apiMethod: 'JSONP',
    jsonQueryDsl: false,
  };

  beforeEach(() => {
    solrSearcherPreprocessorSvc = getSolrSearcherPreprocessorSvc(
      structuredClone(freshDefaultConfig),
    );
  });

  function baseSearcher(overrides) {
    var o = {
      fieldList: ['id', 'title'],
      hlFieldList: ['title'],
      url: 'http://localhost:8983/solr/core/select',
      args: { q: ['#$query##'] },
      queryText: 'findme',
      config: {
        sanitize: false,
        highlight: true,
        debug: false,
        numberOfRows: 10,
        escapeQuery: false,
        apiMethod: 'JSONP',
        qOption: 'q',
      },
      HIGHLIGHTING_PRE: 'PRE',
      HIGHLIGHTING_POST: 'POST',
    };
    // Same deepMerge semantics as services/utilsSvc.js (see utilsSvcStub).
    return deepMerge(structuredClone(o), overrides || {});
  }

  it('merges default Solr config when config is partially specified', () => {
    var searcher = {
      fieldList: ['id', 'title'],
      hlFieldList: ['title'],
      url: 'http://localhost:8983/solr/core/select',
      args: { q: ['#$query##'] },
      queryText: 'findme',
      config: {
        escapeQuery: false,
        highlight: false,
        debug: false,
        numberOfRows: 10,
        apiMethod: 'JSONP',
        qOption: 'q',
      },
      HIGHLIGHTING_PRE: 'PRE',
      HIGHLIGHTING_POST: 'POST',
    };
    expect(Object.hasOwn(searcher.config, 'sanitize')).toBe(false);
    solrSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.config.sanitize).toBe(true);
    expect(searcher.callUrl).toContain('wt=json');
  });

  it('sets hl=true and highlight params when highlight is on and hlFieldList is non-empty', () => {
    var searcher = baseSearcher();
    solrSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.callUrl).toContain('hl=true');
    expect(searcher.callUrl).toContain('hl.fl');
    expect(searcher.callUrl).toContain('hl.simple.pre=PRE');
  });

  it('sets hl=false when highlight is off', () => {
    var searcher = baseSearcher();
    searcher.config.highlight = false;
    solrSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.callUrl).toContain('hl=false');
  });

  it('adds debug params when config.debug is true', () => {
    var searcher = baseSearcher();
    searcher.config.debug = true;
    solrSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.callUrl).toContain('debug=true');
    expect(searcher.callUrl).toContain('debug.explain.structured=true');
  });

  it('hydrates the query from queryText into the call URL', () => {
    var searcher = baseSearcher({ queryText: 'uniqueToken' });
    solrSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.callUrl.indexOf('uniqueToken')).not.toBe(-1);
  });

  it('appends linkUrl with indent and echoParams', () => {
    var searcher = baseSearcher({
      config: { sanitize: false, highlight: false, debug: false, escapeQuery: false, qOption: 'q' },
    });
    solrSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.linkUrl).toContain('indent=true');
    expect(searcher.linkUrl).toContain('echoParams=all');
  });

  describe('JSON Query DSL', () => {
    // config.jsonQueryDsl is a required, explicit signal - no shape-based inference - so
    // every test here sets it directly rather than relying on args' shape to imply it.
    it('builds a queryDsl body instead of a callUrl querystring when jsonQueryDsl is true', () => {
      var searcher = baseSearcher({
        queryText: 'uniqueToken',
        config: { jsonQueryDsl: true, highlight: false },
      });
      searcher.args = { query: 'title:#$query##' };
      solrSearcherPreprocessorSvc.prepare(searcher);
      expect(searcher.queryDsl).toEqual({
        query: 'title:uniqueToken',
        fields: 'id,title',
        limit: 10,
      });
      expect(searcher.callUrl).toBe('http://localhost:8983/solr/core/select');
    });

    it('embeds the full JSON body as a "json" query param in linkUrl instead of a bare endpoint URL', () => {
      // Regression test: linkUrl (Quepid's "open in Solr" affordance - see queriesSvc.js)
      // used to be set to the bare endpoint URL in DSL mode, losing the query entirely -
      // Solr accepts the JSON body as a "json" query parameter, equivalent to the POST body
      // (https://solr.apache.org/guide/solr/latest/query-guide/json-request-api.html), so
      // embed it there instead.
      var searcher = baseSearcher({
        queryText: 'findme',
        config: { jsonQueryDsl: true, debug: true, highlight: false },
      });
      searcher.args = { query: 'title:#$query##' };
      solrSearcherPreprocessorSvc.prepare(searcher);

      expect(searcher.callUrl).toBe('http://localhost:8983/solr/core/select');
      var linkUrl = new URL(searcher.linkUrl);
      expect(linkUrl.origin + linkUrl.pathname).toBe('http://localhost:8983/solr/core/select');
      expect(linkUrl.searchParams.get('indent')).toBe('true');
      expect(linkUrl.searchParams.get('echoParams')).toBe('all');
      expect(JSON.parse(linkUrl.searchParams.get('json'))).toEqual(searcher.queryDsl);
    });

    it('hydrates the query wherever it appears, including nested objects', () => {
      var searcher = baseSearcher({ queryText: 'findme', config: { jsonQueryDsl: true } });
      searcher.args = { query: { edismax: { query: 'title:#$query##' } } };
      solrSearcherPreprocessorSvc.prepare(searcher);
      expect(searcher.queryDsl.query).toEqual({ edismax: { query: 'title:findme' } });
    });

    it('does not override an explicit fields or limit already in query_params', () => {
      var searcher = baseSearcher({ config: { jsonQueryDsl: true } });
      searcher.args = { query: '#$query##', fields: 'id', limit: 5 };
      solrSearcherPreprocessorSvc.prepare(searcher);
      expect(searcher.queryDsl.fields).toBe('id');
      expect(searcher.queryDsl.limit).toBe(5);
    });

    describe('config.escapeQuery', () => {
      it('escapes Solr query-syntax reserved characters when true', () => {
        var searcher = baseSearcher({
          queryText: 'title:law',
          config: { jsonQueryDsl: true, escapeQuery: true },
        });
        searcher.args = { query: '#$query##' };
        solrSearcherPreprocessorSvc.prepare(searcher);
        expect(searcher.queryDsl.query).toBe('title\\:law');
      });

      it('leaves the query text untouched when false', () => {
        var searcher = baseSearcher({
          queryText: 'title:law',
          config: { jsonQueryDsl: true, escapeQuery: false },
        });
        searcher.args = { query: '#$query##' };
        solrSearcherPreprocessorSvc.prepare(searcher);
        expect(searcher.queryDsl.query).toBe('title:law');
      });
    });

    describe('config.debug', () => {
      it('adds debug params nested under "params" when true', () => {
        // Regression test: config.debug used to be a silent no-op in DSL mode - see
        // prepareJsonQueryDslRequest's header comment.
        var searcher = baseSearcher({
          config: { jsonQueryDsl: true, debug: true, highlight: false },
        });
        searcher.args = { query: '#$query##' };
        solrSearcherPreprocessorSvc.prepare(searcher);
        expect(searcher.queryDsl.params).toEqual({
          debug: true,
          'debug.explain.structured': true,
        });
      });

      it('does not add a "params" key when false', () => {
        var searcher = baseSearcher({
          config: { jsonQueryDsl: true, debug: false, highlight: false },
        });
        searcher.args = { query: '#$query##' };
        solrSearcherPreprocessorSvc.prepare(searcher);
        expect(searcher.queryDsl.params).toBeUndefined();
      });
    });

    describe('config.highlight', () => {
      it('adds highlight params nested under "params" when on and hlFieldList is non-empty', () => {
        // Regression test: config.highlight used to be a silent no-op in DSL mode - see
        // prepareJsonQueryDslRequest's header comment.
        var searcher = baseSearcher({ config: { jsonQueryDsl: true, highlight: true, debug: false } });
        searcher.args = { query: '#$query##' };
        solrSearcherPreprocessorSvc.prepare(searcher);
        expect(searcher.queryDsl.params).toEqual({
          hl: true,
          'hl.method': 'unified',
          'hl.fl': 'title',
          'hl.simple.pre': 'PRE',
          'hl.simple.post': 'POST',
        });
      });

      it('does not add highlight params when hlFieldList is empty', () => {
        // Built directly rather than via baseSearcher(): deepMerge (matching utilsSvc.js
        // semantics) merges arrays by index, so an empty-array override can't clear an
        // already-populated default array.
        var searcher = {
          fieldList: ['id', 'title'],
          hlFieldList: [],
          url: 'http://localhost:8983/solr/core/select',
          args: { query: '#$query##' },
          queryText: 'findme',
          config: { jsonQueryDsl: true, highlight: true, debug: false, numberOfRows: 10 },
          HIGHLIGHTING_PRE: 'PRE',
          HIGHLIGHTING_POST: 'POST',
        };
        solrSearcherPreprocessorSvc.prepare(searcher);
        expect(searcher.queryDsl.params).toBeUndefined();
      });

      it('merges into params already present in the caller template instead of overwriting them', () => {
        var searcher = baseSearcher({ config: { jsonQueryDsl: true, debug: true, highlight: true } });
        searcher.args = { query: '#$query##', params: { explainOther: ['doc1'] } };
        solrSearcherPreprocessorSvc.prepare(searcher);
        expect(searcher.queryDsl.params.explainOther).toEqual(['doc1']);
        expect(searcher.queryDsl.params.debug).toBe(true);
        expect(searcher.queryDsl.params.hl).toBe(true);
      });
    });

    describe('config.jsonQueryDsl (explicit signal, not inferred)', () => {
      it('true always takes the JSON DSL path, regardless of args shape', () => {
        var searcher = baseSearcher({ config: { jsonQueryDsl: true } });
        searcher.args = { q: ['#$query##'] };
        solrSearcherPreprocessorSvc.prepare(searcher);
        expect(searcher.queryDsl).toBeDefined();
        expect(searcher.callUrl).toBe('http://localhost:8983/solr/core/select');
      });

      it('false always takes the classic path, regardless of args shape', () => {
        var searcher = baseSearcher({ config: { jsonQueryDsl: false } });
        searcher.args = { query: '#$query##' };
        solrSearcherPreprocessorSvc.prepare(searcher);
        expect(searcher.queryDsl).toBeUndefined();
        expect(searcher.callUrl).toContain('http://localhost:8983/solr/core/select?');
      });

      it('defaults to the classic path (false) when left unset', () => {
        var searcher = baseSearcher();
        searcher.args = { q: ['#$query##'] };
        solrSearcherPreprocessorSvc.prepare(searcher);
        expect(searcher.config.jsonQueryDsl).toBe(false);
        expect(searcher.queryDsl).toBeUndefined();
        expect(searcher.callUrl).toContain('http://localhost:8983/solr/core/select?');
      });
    });
  });
});

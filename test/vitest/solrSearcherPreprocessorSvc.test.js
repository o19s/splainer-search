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
      var searcher = baseSearcher({ queryText: 'uniqueToken', config: { jsonQueryDsl: true } });
      searcher.args = { query: 'title:#$query##' };
      solrSearcherPreprocessorSvc.prepare(searcher);
      expect(searcher.queryDsl).toEqual({
        query: 'title:uniqueToken',
        fields: 'id,title',
        limit: 10,
      });
      expect(searcher.callUrl).toBe('http://localhost:8983/solr/core/select');
      expect(searcher.linkUrl).toBe('http://localhost:8983/solr/core/select');
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

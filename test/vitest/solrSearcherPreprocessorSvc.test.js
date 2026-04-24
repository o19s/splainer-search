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
});

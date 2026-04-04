'use strict';

/* global describe, beforeEach, inject, it, expect, module */

/**
 * Unit tests for {@link solrSearcherPreprocessorSvc#prepare}: URL building,
 * config merge with defaults, highlight and debug flags.
 */
describe('Service: solrSearcherPreprocessorSvc', function() {

  // Fresh defaultSolrConfig so other specs cannot mutate the shared value() and break merge assertions.
  beforeEach(module('o19s.splainer-search', function($provide) {
    $provide.value('defaultSolrConfig', {
      sanitize: true,
      highlight: true,
      debug: true,
      numberOfRows: 10,
      escapeQuery: true,
      apiMethod: 'JSONP'
    });
  }));

  var solrSearcherPreprocessorSvc;

  beforeEach(inject(function(_solrSearcherPreprocessorSvc_) {
    solrSearcherPreprocessorSvc = _solrSearcherPreprocessorSvc_;
  }));

  // Simple recursive merge for test setup — replaces angular.merge.
  function testDeepMerge(target, source) {
    Object.keys(source).forEach(function(key) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
          target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        testDeepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
    return target;
  }

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
        qOption: 'q'
      },
      HIGHLIGHTING_PRE: 'PRE',
      HIGHLIGHTING_POST: 'POST'
    };
    // Use deep merge (not Object.assign) so partial overrides like { config: { debug: true } }
    // patch nested fields instead of replacing the whole config object.
    return testDeepMerge(structuredClone(o), overrides || {});
  }

  it('merges default Solr config when config is partially specified', function() {
    // Config intentionally omits sanitize so prepare() must supply it from defaultSolrConfig.
    // (baseSearcher() merges in sanitize: false from its template, which would override the default.)
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
        qOption: 'q'
      },
      HIGHLIGHTING_PRE: 'PRE',
      HIGHLIGHTING_POST: 'POST'
    };
    expect(searcher.config.hasOwnProperty('sanitize')).toBe(false);
    solrSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.config.sanitize).toBe(true);
    expect(searcher.callUrl).toContain('wt=json');
  });

  it('sets hl=true and highlight params when highlight is on and hlFieldList is non-empty', function() {
    var searcher = baseSearcher();
    solrSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.callUrl).toContain('hl=true');
    expect(searcher.callUrl).toContain('hl.fl');
    expect(searcher.callUrl).toContain('hl.simple.pre=PRE');
  });

  it('sets hl=false when highlight is off', function() {
    var searcher = baseSearcher();
    searcher.config.highlight = false;
    solrSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.callUrl).toContain('hl=false');
  });

  it('adds debug params when config.debug is true', function() {
    var searcher = baseSearcher();
    searcher.config.debug = true;
    solrSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.callUrl).toContain('debug=true');
    expect(searcher.callUrl).toContain('debug.explain.structured=true');
  });

  it('hydrates the query from queryText into the call URL', function() {
    var searcher = baseSearcher({ queryText: 'uniqueToken' });
    solrSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.callUrl.indexOf('uniqueToken')).not.toBe(-1);
  });

  it('appends linkUrl with indent and echoParams', function() {
    var searcher = baseSearcher({ config: { sanitize: false, highlight: false, debug: false, escapeQuery: false, qOption: 'q' } });
    solrSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.linkUrl).toContain('indent=true');
    expect(searcher.linkUrl).toContain('echoParams=all');
  });
});

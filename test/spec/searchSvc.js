'use strict';

/* global describe, beforeEach, inject, it, expect, module */

/**
 * Unit tests for {@link searchSvc}: engine dispatch, default config copy,
 * and Basic Auth header injection on {@link searchSvc#createSearcher}.
 */
describe('Service: searchSvc', function() {

  beforeEach(module('o19s.splainer-search'));

  var searchSvc;
  var fieldSpecSvc;
  var defaultSolrConfig;
  var mockFieldSpec;
  var mockEsUrl = 'http://localhost:9200/index/_search';
  var mockEsArgs = {
    query: {
      term: {
        text: '#$query##'
      }
    }
  };

  beforeEach(inject(function(_searchSvc_, _fieldSpecSvc_, _defaultSolrConfig_) {
    searchSvc = _searchSvc_;
    fieldSpecSvc = _fieldSpecSvc_;
    defaultSolrConfig = _defaultSolrConfig_;
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1');
  }));

  describe('configFromDefault', function() {
    it('returns a deep copy; mutating it does not change the default value', function() {
      var c = searchSvc.configFromDefault();
      expect(c).not.toBe(defaultSolrConfig);
      var origSanitize = defaultSolrConfig.sanitize;
      c.sanitize = !origSanitize;
      expect(defaultSolrConfig.sanitize).toBe(origSanitize);
    });
  });

  describe('createSearcher', function() {
    it('defaults searchEngine to solr when omitted', function() {
      var s = searchSvc.createSearcher(
        mockFieldSpec,
        'http://localhost:8983/solr/core/select',
        { q: ['#$query##'] },
        'q',
        {
          escapeQuery: false,
          highlight: false,
          debug: false
        }
      );
      expect(s.type).toBe('solr');
    });

    it('routes OpenSearch (os) through the same factory as Elasticsearch (es)', function() {
      var esSearcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        {},
        'es'
      );
      var osSearcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        {},
        'os'
      );
      expect(osSearcher.type).toBe('os');
      expect(esSearcher.type).toBe('es');
      expect(osSearcher.constructor).toBe(esSearcher.constructor);
    });

    it('adds Authorization from basicAuthCredential when customHeaders is absent', function() {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        { basicAuthCredential: 'alice:secret' },
        'es'
      );
      var headers = JSON.parse(searcher.config.customHeaders);
      expect(headers.Authorization).toBe('Basic ' + btoa('alice:secret'));
    });

    it('merges Authorization into existing customHeaders JSON', function() {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        {
          basicAuthCredential: 'u:p',
          customHeaders: JSON.stringify({ 'X-Custom': '1' })
        },
        'es'
      );
      var headers = JSON.parse(searcher.config.customHeaders);
      expect(headers.Authorization).toBe('Basic ' + btoa('u:p'));
      expect(headers['X-Custom']).toBe('1');
    });

    it('uses Authorization-only headers when customHeaders JSON is invalid', function() {
      spyOn(console, 'warn');
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        {
          basicAuthCredential: 'u:p',
          customHeaders: 'not-json'
        },
        'es'
      );
      var headers = JSON.parse(searcher.config.customHeaders);
      expect(headers.Authorization).toBe('Basic ' + btoa('u:p'));
      expect(Object.keys(headers).length).toBe(1);
      expect(console.warn).toHaveBeenCalled();
    });

    it('does not set customHeaders when basicAuthCredential is empty', function() {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        { basicAuthCredential: '' },
        'es'
      );
      expect(searcher.config.customHeaders).toBeUndefined();
    });

    it('does not set customHeaders when basicAuthCredential is omitted', function() {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        {},
        'es'
      );
      expect(searcher.config.customHeaders).toBeUndefined();
    });
  });
});

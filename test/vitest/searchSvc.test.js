import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFetchClient } from '../../services/httpClient.js';
import { MockHttpBackend } from './helpers/mockHttpBackend.js';
import { getSearchSvc, getFieldSpecSvc } from './helpers/serviceFactory.js';
import { defaultSolrConfig } from '../../values/defaultSolrConfig.js';

describe('searchSvc', () => {
  var searchSvc, fieldSpecSvc, mockFieldSpec;
  var mockEsUrl = 'http://localhost:9200/index/_search';
  var mockEsArgs = {
    query: { term: { text: '#$query##' } },
  };

  beforeEach(() => {
    var mockBackend = new MockHttpBackend();
    var httpClient = createFetchClient({
      fetch: mockBackend.fetch,
      jsonpRequest: mockBackend.jsonpRequest,
    });
    searchSvc = getSearchSvc(httpClient);
    fieldSpecSvc = getFieldSpecSvc();
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('configFromDefault', () => {
    it('returns a deep copy; mutating it does not change the default value', () => {
      var c = searchSvc.configFromDefault();
      expect(c).not.toBe(defaultSolrConfig);
      var origSanitize = defaultSolrConfig.sanitize;
      c.sanitize = !origSanitize;
      expect(defaultSolrConfig.sanitize).toBe(origSanitize);
    });
  });

  describe('createSearcher', () => {
    it('defaults searchEngine to solr when omitted', () => {
      var s = searchSvc.createSearcher(
        mockFieldSpec,
        'http://localhost:8983/solr/core/select',
        { q: ['#$query##'] },
        'q',
        { escapeQuery: false, highlight: false, debug: false },
      );
      expect(s.type).toBe('solr');
    });

    it('routes OpenSearch (os) through the same factory as Elasticsearch (es)', () => {
      var esSearcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        {},
        'es',
      );
      var osSearcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        {},
        'os',
      );
      expect(osSearcher.type).toBe('os');
      expect(esSearcher.type).toBe('es');
      expect(osSearcher.constructor).toBe(esSearcher.constructor);
    });

    it('adds Authorization from basicAuthCredential when customHeaders is absent', () => {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        { basicAuthCredential: 'alice:secret' },
        'es',
      );
      var headers = JSON.parse(searcher.config.customHeaders);
      expect(headers.Authorization).toBe('Basic ' + btoa('alice:secret'));
    });

    it('merges Authorization into existing customHeaders JSON', () => {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        { basicAuthCredential: 'u:p', customHeaders: JSON.stringify({ 'X-Custom': '1' }) },
        'es',
      );
      var headers = JSON.parse(searcher.config.customHeaders);
      expect(headers.Authorization).toBe('Basic ' + btoa('u:p'));
      expect(headers['X-Custom']).toBe('1');
    });

    it('uses Authorization-only headers when customHeaders JSON is invalid', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        { basicAuthCredential: 'u:p', customHeaders: 'not-json' },
        'es',
      );
      var headers = JSON.parse(searcher.config.customHeaders);
      expect(headers.Authorization).toBe('Basic ' + btoa('u:p'));
      expect(Object.keys(headers).length).toBe(1);
      expect(console.warn).toHaveBeenCalled();
    });

    it('does not set customHeaders when basicAuthCredential is empty', () => {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        { basicAuthCredential: '' },
        'es',
      );
      expect(searcher.config.customHeaders).toBeUndefined();
    });

    it('does not set customHeaders when basicAuthCredential is omitted', () => {
      var searcher = searchSvc.createSearcher(
        mockFieldSpec,
        mockEsUrl,
        mockEsArgs,
        'elastic',
        {},
        'es',
      );
      expect(searcher.config.customHeaders).toBeUndefined();
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSearchApiSearcherPreprocessorSvc } from './helpers/serviceFactory.js';

describe('searchApiSearcherPreprocessorSvc', () => {
  var searchApiSearcherPreprocessorSvc;

  beforeEach(() => {
    searchApiSearcherPreprocessorSvc = getSearchApiSearcherPreprocessorSvc();
  });

  it('prepends ? to URLs with no query string when using GET', () => {
    var searcher = {
      config: { apiMethod: 'GET', qOption: null },
      args: { query: '#$query##' },
      queryText: 'plain',
      url: 'http://mycompany/bob/search',
    };
    searchApiSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.url).toBe('http://mycompany/bob/search?query=plain');
  });

  it('appends params to URLs that already contain query strings without duplicating question marks', () => {
    var searcher = {
      config: { apiMethod: 'GET', qOption: null },
      args: { query: '#$query##' },
      queryText: 'something',
      url: 'http://mycompany/bob/something?x=y&b=s',
    };
    searchApiSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.url).toBe('http://mycompany/bob/something?x=y&b=s&query=something');
  });

  it('honors URLs that end with a question mark without adding an extra delimiter', () => {
    var searcher = {
      config: { apiMethod: 'GET', qOption: null },
      args: { query: '#$query##' },
      queryText: 'something',
      url: 'http://mycompany/bob/something?',
    };
    searchApiSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.url).toBe('http://mycompany/bob/something?query=something');
  });

  it('uses object queryText as GET param map without going through the template hydrator', () => {
    var searcher = {
      config: { apiMethod: 'GET', qOption: null },
      args: { query: '#$query##' },
      queryText: { alpha: 'one', beta: 2 },
      url: 'http://example.com/api',
    };
    searchApiSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.url.indexOf('http://example.com/api?')).toBe(0);
    expect(searcher.url).toContain('alpha=one');
    expect(searcher.url).toContain('beta=2');
  });

  it('sets queryDsl on POST from hydrated args and queryText', () => {
    var searcher = {
      config: { apiMethod: 'POST', qOption: null },
      args: { query: '#$query##' },
      queryText: 'hydrate-me',
      url: 'http://example.com/api',
    };
    searchApiSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.queryDsl).toEqual({ query: 'hydrate-me' });
  });

  it('sets queryDsl to object queryText on POST without templating', () => {
    var dsl = { filter: 'x', size: 5 };
    var searcher = {
      config: { apiMethod: 'POST', qOption: { corpusId: 1 } },
      args: { query: '#$query##' },
      queryText: dsl,
      url: 'http://example.com/api',
    };
    searchApiSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.queryDsl).toBe(dsl);
  });

  it('escapes backslashes and double quotes in string queryText before POST hydration', () => {
    var searcher = {
      config: { apiMethod: 'POST', qOption: null },
      args: { q: '#$query##' },
      queryText: 'a\\b"c',
      url: 'http://example.com/api',
    };
    searchApiSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.queryDsl).toEqual({ q: 'a\\\\b\\"c' });
  });

  it('GET with null queryText still builds params from template object', () => {
    var searcher = {
      config: { apiMethod: 'GET', qOption: null },
      args: { query: '#$query##', rows: '10' },
      queryText: null,
      url: 'http://example.com/api',
    };
    searchApiSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.url.indexOf('http://example.com/api?')).toBe(0);
    // GET param values are URL-encoded; #$query## (unsubstituted, since queryText is null) encodes to this.
    expect(searcher.url).toContain('query=%23%24query%23%23');
    expect(searcher.url).toContain('rows=10');
  });

  it('GET throws when args and queryText are both null', () => {
    var searcher = {
      config: { apiMethod: 'GET', qOption: null },
      args: null,
      queryText: null,
      url: 'http://example.com/api',
    };
    expect(function () {
      searchApiSearcherPreprocessorSvc.prepare(searcher);
    }).toThrow();
  });

  it('defaults hits/offset from numberOfRows when paginationHitsParam/paginationOffsetParam are configured', () => {
    var searcher = {
      config: {
        apiMethod: 'POST',
        qOption: null,
        numberOfRows: 10,
        paginationHitsParam: 'hits',
        paginationOffsetParam: 'offset',
      },
      args: { yql: 'select * from sources *' },
      queryText: 'plain',
      url: 'http://example.com/api',
    };
    searchApiSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.queryDsl).toEqual({
      yql: 'select * from sources *',
      hits: '10',
      offset: '0',
    });
  });

  it('does not override hits/offset already present in args', () => {
    var searcher = {
      config: {
        apiMethod: 'POST',
        qOption: null,
        numberOfRows: 10,
        paginationHitsParam: 'hits',
        paginationOffsetParam: 'offset',
      },
      args: { yql: 'select * from sources *', hits: '2', offset: '20' },
      queryText: 'plain',
      url: 'http://example.com/api',
    };
    searchApiSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.queryDsl).toEqual({
      yql: 'select * from sources *',
      hits: '2',
      offset: '20',
    });
  });

  it('leaves args untouched when paginationHitsParam/paginationOffsetParam are not configured', () => {
    var searcher = {
      config: { apiMethod: 'POST', qOption: null, numberOfRows: 10 },
      args: { yql: 'select * from sources *' },
      queryText: 'plain',
      url: 'http://example.com/api',
    };
    searchApiSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.queryDsl).toEqual({ yql: 'select * from sources *' });
  });

  describe('AUTO apiMethod', () => {
    it('picks GET when the hydrated query fits within maxGetUrlLength', () => {
      var searcher = {
        config: { apiMethod: 'AUTO', qOption: null, maxGetUrlLength: 100 },
        args: { yql: '#$query##' },
        queryText: 'select * from movies where true',
        url: 'http://example.com/search',
      };
      searchApiSearcherPreprocessorSvc.prepare(searcher);
      expect(searcher.apiMethod).toBe('GET');
      expect(searcher.url).toContain('yql=');
      expect(searcher.queryDsl).toBeUndefined();
    });

    it('picks POST when the hydrated query exceeds maxGetUrlLength', () => {
      var searcher = {
        config: { apiMethod: 'AUTO', qOption: null, maxGetUrlLength: 20 },
        args: { yql: '#$query##' },
        queryText: 'select * from movies where title contains "a long query that will not fit"',
        url: 'http://example.com/search',
      };
      searchApiSearcherPreprocessorSvc.prepare(searcher);
      expect(searcher.apiMethod).toBe('POST');
      expect(searcher.queryDsl).toEqual({
        yql: 'select * from movies where title contains \\"a long query that will not fit\\"',
      });
      expect(searcher.url).toBe('http://example.com/search');
    });

    it('falls back to the default max length when maxGetUrlLength is not configured', () => {
      var searcher = {
        config: { apiMethod: 'AUTO', qOption: null },
        args: { yql: '#$query##' },
        queryText: 'select * from movies where true',
        url: 'http://example.com/search',
      };
      searchApiSearcherPreprocessorSvc.prepare(searcher);
      expect(searcher.apiMethod).toBe('GET');
    });

    it('does not mutate searcher.config when resolving AUTO', () => {
      var config = { apiMethod: 'AUTO', qOption: null, maxGetUrlLength: 100 };
      var searcher = {
        config: config,
        args: { yql: '#$query##' },
        queryText: 'select * from movies where true',
        url: 'http://example.com/search',
      };
      searchApiSearcherPreprocessorSvc.prepare(searcher);
      expect(config.apiMethod).toBe('AUTO');
      expect(searcher.apiMethod).toBe('GET');
    });

    it('URL-encodes GET param values', () => {
      var searcher = {
        config: { apiMethod: 'GET', qOption: null },
        args: { yql: '#$query##' },
        queryText: 'title contains matrix and year > 1990',
        url: 'http://example.com/search',
      };
      searchApiSearcherPreprocessorSvc.prepare(searcher);
      expect(searcher.url).toBe(
        'http://example.com/search?yql=' +
          encodeURIComponent('title contains matrix and year > 1990'),
      );
    });
  });

  it('warns and leaves args untouched when only one of paginationHitsParam/paginationOffsetParam is configured', () => {
    var warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    var searcher = {
      config: {
        apiMethod: 'POST',
        qOption: null,
        numberOfRows: 10,
        paginationHitsParam: 'hits',
        // paginationOffsetParam intentionally omitted
      },
      args: { yql: 'select * from sources *' },
      queryText: 'plain',
      url: 'http://example.com/api',
    };
    searchApiSearcherPreprocessorSvc.prepare(searcher);
    expect(searcher.queryDsl).toEqual({ yql: 'select * from sources *' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

'use strict';

/**
 * Covers Search API request shaping: GET query-string assembly (including URL edge cases),
 * POST body hydration via queryTemplateSvc, object queryText overrides, and string escaping
 * before templating.
 */
/*global describe,beforeEach,inject,it,expect*/
describe('Service: searchApiSearcherPreprocessorSvc', function () {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  var searchApiSearcherPreprocessorSvc;

  beforeEach(inject(function (_searchApiSearcherPreprocessorSvc_) {
    searchApiSearcherPreprocessorSvc = _searchApiSearcherPreprocessorSvc_;
  }));

  it('prepends ? to URLs with no query string when using GET', function () {
    var searcher = {
      config: {
        apiMethod: 'GET',
        qOption: null
      },
      args: {
        query: '#$query##'
      },
      queryText: 'plain',
      url: 'http://mycompany/bob/search'
    };

    searchApiSearcherPreprocessorSvc.prepare(searcher);

    expect(searcher.url).toBe('http://mycompany/bob/search?query=plain');
  });

  it('appends params to URLs that already contain query strings without duplicating question marks', function () {
    var searcher = {
      config: {
        apiMethod: 'GET',
        qOption: null
      },
      args: {
        query: '#$query##'
      },
      queryText: 'something',
      url: 'http://mycompany/bob/something?x=y&b=s'
    };

    searchApiSearcherPreprocessorSvc.prepare(searcher);

    expect(searcher.url).toBe('http://mycompany/bob/something?x=y&b=s&query=something');
  });

  it('honors URLs that end with a question mark without adding an extra delimiter', function () {
    var searcher = {
      config: {
        apiMethod: 'GET',
        qOption: null
      },
      args: {
        query: '#$query##'
      },
      queryText: 'something',
      url: 'http://mycompany/bob/something?'
    };

    searchApiSearcherPreprocessorSvc.prepare(searcher);

    expect(searcher.url).toBe('http://mycompany/bob/something?query=something');
  });

  it('uses object queryText as GET param map without going through the template hydrator', function () {
    var searcher = {
      config: {
        apiMethod: 'GET',
        qOption: null
      },
      args: {
        query: '#$query##'
      },
      queryText: { alpha: 'one', beta: 2 },
      url: 'http://example.com/api'
    };

    searchApiSearcherPreprocessorSvc.prepare(searcher);

    expect(searcher.url.indexOf('http://example.com/api?')).toBe(0);
    expect(searcher.url).toContain('alpha=one');
    expect(searcher.url).toContain('beta=2');
  });

  it('sets queryDsl on POST from hydrated args and queryText', function () {
    var searcher = {
      config: {
        apiMethod: 'POST',
        qOption: null
      },
      args: {
        query: '#$query##'
      },
      queryText: 'hydrate-me',
      url: 'http://example.com/api'
    };

    searchApiSearcherPreprocessorSvc.prepare(searcher);

    expect(searcher.queryDsl).toEqual({ query: 'hydrate-me' });
  });

  it('sets queryDsl to object queryText on POST without templating', function () {
    var dsl = { filter: 'x', size: 5 };
    var searcher = {
      config: {
        apiMethod: 'POST',
        qOption: { corpusId: 1 }
      },
      args: {
        query: '#$query##'
      },
      queryText: dsl,
      url: 'http://example.com/api'
    };

    searchApiSearcherPreprocessorSvc.prepare(searcher);

    expect(searcher.queryDsl).toBe(dsl);
  });

  it('escapes backslashes and double quotes in string queryText before POST hydration', function () {
    var searcher = {
      config: {
        apiMethod: 'POST',
        qOption: null
      },
      args: {
        q: '#$query##'
      },
      queryText: 'a\\b"c',
      url: 'http://example.com/api'
    };

    searchApiSearcherPreprocessorSvc.prepare(searcher);

    // Mirrors replaceQuery: \\ -> \\\\, then " -> \", then hydrate fills #$query##.
    expect(searcher.queryDsl).toEqual({ q: 'a\\\\b\\"c' });
  });

  it('GET with null queryText still builds params from template object (angular.isObject branch)', function () {
    var searcher = {
      config: {
        apiMethod: 'GET',
        qOption: null
      },
      args: {
        query: '#$query##',
        rows: '10'
      },
      queryText: null,
      url: 'http://example.com/api'
    };

    searchApiSearcherPreprocessorSvc.prepare(searcher);

    expect(searcher.url.indexOf('http://example.com/api?')).toBe(0);
    expect(searcher.url).toContain('query=#$query##');
    expect(searcher.url).toContain('rows=10');
  });

  it('GET throws when args and queryText are both null (queryDsl null, not angular.isObject)', function () {
    var searcher = {
      config: {
        apiMethod: 'GET',
        qOption: null
      },
      args: null,
      queryText: null,
      url: 'http://example.com/api'
    };

    expect(function () {
      searchApiSearcherPreprocessorSvc.prepare(searcher);
    }).toThrow();
  });
});

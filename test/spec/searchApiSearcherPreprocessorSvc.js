'use strict';
/*global describe,beforeEach,inject,it,expect*/
describe('Service: searchApiSearcherPreprocessorSvc', function () {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  var searchApiSearcherPreprocessorSvc;

  beforeEach(inject(function (_searchApiSearcherPreprocessorSvc_) {
    searchApiSearcherPreprocessorSvc = _searchApiSearcherPreprocessorSvc_;
  }));

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
});

'use strict';
/*global describe,beforeEach,inject,it,expect*/
describe('Service: esUrlSvc', function () {

  beforeEach(module('o19s.splainer-search'));

  var esUrlSvc;

  beforeEach(inject(function (_esUrlSvc_) {
    esUrlSvc = _esUrlSvc_;
  }));

  describe('parse URL', function() {
    it('extracts the different parts of a URL', function() {
      var url = 'http://localhost:9200/tmdb/_search';
      var uri = esUrlSvc.parseUrl(url);

      expect(uri.protocol).toBe('http');
      expect(uri.host).toBe('localhost:9200');
      expect(uri.pathname).toBe('/tmdb/_search');

      url = 'http://es.quepid.com/tmdb/_search';
      uri = esUrlSvc.parseUrl(url);

      expect(uri.protocol).toBe('http');
      expect(uri.host).toBe('es.quepid.com');
      expect(uri.pathname).toBe('/tmdb/_search');

      url = 'https://es.quepid.com/tmdb/_search';
      uri = esUrlSvc.parseUrl(url);

      expect(uri.protocol).toBe('https');
      expect(uri.host).toBe('es.quepid.com');
      expect(uri.pathname).toBe('/tmdb/_search');

      url = 'https://es.quepid.com/tmdb/_search/template';
      uri = esUrlSvc.parseUrl(url);

      expect(uri.protocol).toBe('https');
      expect(uri.host).toBe('es.quepid.com');
      expect(uri.pathname).toBe('/tmdb/_search/template');
    });

    it('adds http if the protocol is missing', function() {
      var url = 'localhost:9200/tmdb/_search';
      var uri = esUrlSvc.parseUrl(url);

      expect(uri.protocol).toBe('http');
    });

    it('retrieves the username and password if available', function() {
      var url = 'http://es.quepid.com/tmdb/_search';
      var uri = esUrlSvc.parseUrl(url);

      expect(uri.username).toBe('');
      expect(uri.password).toBe('');

      url = 'http://username:password@es.quepid.com/tmdb/_search';
      uri = esUrlSvc.parseUrl(url);

      expect(uri.username).toBe('username');
      expect(uri.password).toBe('password');

      url = 'http://username:password@localhost:9200/tmdb/_search';
      uri = esUrlSvc.parseUrl(url);

      expect(uri.username).toBe('username');
      expect(uri.password).toBe('password');

    });

    it('understands when bulk endpoint used', function() {
      var url = 'http://es.quepid.com/tmdb/_search';
      var uri = esUrlSvc.parseUrl(url);
      expect(esUrlSvc.isBulkCall(uri)).toBe(false);

      url = 'http://es.quepid.com/tmdb/_msearch';
      uri = esUrlSvc.parseUrl(url);
      expect(esUrlSvc.isBulkCall(uri)).toBe(true);

      url = 'http://es.quepid.com/tmdb/_msearch/';
      uri = esUrlSvc.parseUrl(url);
      expect(esUrlSvc.isBulkCall(uri)).toBe(true);
    });

    it('understands when template endpoint used', function() {
      // the 'id' tells us that we have a templated search.
      var templateEsParams  = {
        id: 'tmdb-title-search-template',
        params: {
          search_query: 'star'
        }
      };

      var mockEsParams  = {
        query: {
          match: {
            title: "#$query##"
          }
        }
      };

      expect(esUrlSvc.isTemplateCall(templateEsParams)).toBe(true);
      expect(esUrlSvc.isTemplateCall(mockEsParams)).toBe(false);

    });

  });

  describe('build template render URL', function() {
    var url = 'http://localhost:9200/tmdb/_search';


    var uri = null;
    beforeEach( function () {
      uri = esUrlSvc.parseUrl(url);
    });

    it('builds a proper doc URL from the full search url', function() {
      var renderTemplateUrl = esUrlSvc.buildRenderTemplateUrl(uri);

      expect(renderTemplateUrl).toBe('http://localhost:9200/_render/template');
    });

    it('escapes the # character if it exists in the _id field', function(){
      var doc2 = {
        _index: 'tmdb',
        _type:  'movies',
        _id:    'X#123#BOB'
      };

      var docUrl = esUrlSvc.buildDocUrl(uri, doc2);

      expect(docUrl).toBe('http://localhost:9200/tmdb/movies/_doc/X%23123%23BOB?pretty=true');
    });
  });


  describe('build doc URL', function() {
    var url = 'http://localhost:9200/tmdb/_search';

    var doc = {
      _index: 'tmdb',
      _type:  'movies',
      _id:    '1'
    };

    var uri = null;
    beforeEach( function () {
      uri = esUrlSvc.parseUrl(url);
    });

    it('builds a proper doc URL from the doc info', function() {
      var docUrl = esUrlSvc.buildDocUrl(uri, doc);

      expect(docUrl).toBe('http://localhost:9200/tmdb/movies/_doc/1?pretty=true');
    });
    
    it('builds a proper doc URL from the doc info when the _type is _doc', function() {
      var doc2 = angular.copy(doc);
      doc2._type = '_doc';
      var docUrl = esUrlSvc.buildDocUrl(uri, doc2);

      expect(docUrl).toBe('http://localhost:9200/tmdb/_doc/1?pretty=true');
    });

    it('escapes the # character if it exists in the _id field', function(){
      var doc2 = {
        _index: 'tmdb',
        _type:  'movies',
        _id:    'X#123#BOB'
      };

      var docUrl = esUrlSvc.buildDocUrl(uri, doc2);

      expect(docUrl).toBe('http://localhost:9200/tmdb/movies/_doc/X%23123%23BOB?pretty=true');
    });
  });

  describe('build doc explain URL', function() {
    var url = 'http://localhost:9200/tmdb/_search';

    var doc = {
      _index: 'tmdb',
      _type:  'movies',
      _id:    '1'
    };

    var uri = null;
    beforeEach( function () {
      uri = esUrlSvc.parseUrl(url);
    });

    it('builds a proper doc explain URL from the doc info', function() {
      var docUrl = esUrlSvc.buildExplainUrl(uri, doc);

      expect(docUrl).toBe('http://localhost:9200/tmdb/_explain/1');
    });
  });

  describe('build URL', function() {
    var url = 'http://localhost:9200/tmdb/_search';

    var uri = null;
    beforeEach( function () {
      uri = esUrlSvc.parseUrl(url);
    });

    it('returns the original URL if no params are passed', function() {
      var returnedUrl = esUrlSvc.buildUrl(uri);

      expect(returnedUrl).toBe(url);
    });

    it('returns the original URL if params passed is empty', function() {
      var params = { };
      esUrlSvc.setParams(uri, params);
      var returnedUrl = esUrlSvc.buildUrl(uri);

      expect(returnedUrl).toBe(url);
    });

    it('appends params to the original URL', function() {
      var params = { foo: 'bar' };
      esUrlSvc.setParams(uri, params);
      var returnedUrl = esUrlSvc.buildUrl(uri);

      expect(returnedUrl).toBe(url + '?foo=bar');

      params = { foo: 'bar', bar: 'foo' };
      esUrlSvc.setParams(uri, params);
      returnedUrl = esUrlSvc.buildUrl(uri);

      expect(returnedUrl).toBe(url + '?foo=bar&bar=foo');
    });
  });
  
  describe('stripBasicAuth', function() {
    it('removes embedded basic auth', function() {
      var url = 'https://user:pass@example.com';
      
      var returnedUrl = esUrlSvc.stripBasicAuth(url);

      expect(returnedUrl).toBe('https://example.com');
    });
    
    it('doesnt have issues with no embedded basic auth', function() {
      var url = 'https://example.com';
      
      var returnedUrl = esUrlSvc.stripBasicAuth(url);

      expect(returnedUrl).toBe('https://example.com');
    });
  });
});

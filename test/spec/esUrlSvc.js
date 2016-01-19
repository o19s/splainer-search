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

      expect(docUrl).toBe('http://localhost:9200/tmdb/movies/1');
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

      expect(docUrl).toBe('http://localhost:9200/tmdb/movies/1/_explain');
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
});

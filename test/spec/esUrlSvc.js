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
      esUrlSvc.parseUrl(url);

      expect(esUrlSvc.protocol).toBe('http');
      expect(esUrlSvc.host).toBe('localhost:9200');
      expect(esUrlSvc.pathname).toBe('/tmdb/_search');

      var url = 'http://es.quepid.com/tmdb/_search';
      esUrlSvc.parseUrl(url);

      expect(esUrlSvc.protocol).toBe('http');
      expect(esUrlSvc.host).toBe('es.quepid.com');
      expect(esUrlSvc.pathname).toBe('/tmdb/_search');

      var url = 'https://es.quepid.com/tmdb/_search';
      esUrlSvc.parseUrl(url);

      expect(esUrlSvc.protocol).toBe('https');
      expect(esUrlSvc.host).toBe('es.quepid.com');
      expect(esUrlSvc.pathname).toBe('/tmdb/_search');
    });

    it('adds http if the protocol is missing', function() {
      var url = 'localhost:9200/tmdb/_search';
      esUrlSvc.parseUrl(url);

      expect(esUrlSvc.protocol).toBe('http');
    });

    it('retrieves the username and password if available', function() {
      var url = 'http://es.quepid.com/tmdb/_search';
      esUrlSvc.parseUrl(url);

      expect(esUrlSvc.username).toBe('');
      expect(esUrlSvc.password).toBe('');

      var url = 'http://username:password@es.quepid.com/tmdb/_search';
      esUrlSvc.parseUrl(url);

      expect(esUrlSvc.username).toBe('username');
      expect(esUrlSvc.password).toBe('password');

      var url = 'http://username:password@localhost:9200/tmdb/_search';
      esUrlSvc.parseUrl(url);

      expect(esUrlSvc.username).toBe('username');
      expect(esUrlSvc.password).toBe('password');
    });
  });

  describe('build doc URL', function() {
    var url = 'http://localhost:9200/tmdb/_search';

    var doc = {
      _index: 'tmdb',
      _type:  'movies',
      _id:    '1'
    }

    beforeEach( function () {
      esUrlSvc.parseUrl(url);
    });

    it('builds a proper doc URL from the doc info', function() {
      var docUrl = esUrlSvc.buildDocUrl(doc);

      expect(docUrl).toBe('http://localhost:9200/tmdb/movies/1');
    });
  });

  describe('build URL', function() {
    var url = 'http://localhost:9200/tmdb/_search';

    beforeEach( function () {
      esUrlSvc.parseUrl(url);
    });

    it('returns the original URL if no params are passed', function() {
      var returnedUrl = esUrlSvc.buildUrl();

      expect(returnedUrl).toBe(url);
    });

    it('returns the original URL if params passed is empty', function() {
      var params = { };
      esUrlSvc.setParams(params);
      var returnedUrl = esUrlSvc.buildUrl();

      expect(returnedUrl).toBe(url);
    });

    it('appends params to the original URL', function() {
      var params = { foo: "bar" };
      esUrlSvc.setParams(params);
      var returnedUrl = esUrlSvc.buildUrl();

      expect(returnedUrl).toBe(url + '?foo=bar');

      var params = { foo: "bar", bar: "foo" };
      esUrlSvc.setParams(params);
      var returnedUrl = esUrlSvc.buildUrl();

      expect(returnedUrl).toBe(url + '?foo=bar&bar=foo');
    });
  });
});

'use strict';
/*global describe,beforeEach,inject,it,expect*/
describe('Service: solrUrlSvc', function () {

  beforeEach(module('o19s.splainer-search'));

  var solrUrlSvc = null;
  beforeEach(inject(function (_solrUrlSvc_) {
    solrUrlSvc = _solrUrlSvc_;
  }));

  describe('parse args', function() {
    it('parses solr args correctly', function() {
      var argStr = 'q=1234&q=5678&fq=cat:foo';
      var parsedArgs = solrUrlSvc.parseSolrArgs(argStr);

      expect(parsedArgs.q).toContain('1234');
      expect(parsedArgs.q).toContain('5678');
      expect(parsedArgs.q.length).toEqual(2);
      expect(parsedArgs.fq).toContain('cat:foo');
      expect(parsedArgs.fq.length).toEqual(1);
      expect(parsedArgs.q.length).toEqual(2);
    });

    it('parses urlencoded solr args', function() {
      var argStr = 'q=1234%20foo&q=5678&fq=cat:foo';
      var parsedArgs = solrUrlSvc.parseSolrArgs(argStr);

      expect(parsedArgs.q).toContain('1234 foo');
    });
  });

  describe('parse URL', function() {
    it('removes illegal options', function() {
     var urlStr =  'http://localhost:8983/solr/collection1/select?json.wrf=jQuery1111019348984491080046_1412820011486&facet=true&facet.field=title&facet.limit=10&q=blah&fq=data_source_name:radar&start=0&defType=edismax&qf=title^1&qf=subtitle^.1&qf=keys&qf=desc&qf=author&qf=body&qf=url&mm=2%3C-1+5%3C80%25&ps=1&qs=5&ps2=5&ps3=5&pf=title^10&bq=((*:*+-title:%22Four+short+links%22)^1)&dateboost=recip(ms(NOW,searchDate),3.16e-13,1,1)&fl=id%20search_title%20+desc%20+url%20+author%20+searchDate%20+score&wt=xml&debug=true&debug.explain.structured=true&hl=true&hl.simple.pre=aouaoeuCRAZY_STRING!8_______&hl.simple.post=62362iueaiCRAZY_POST_STRING!_______&indent=true&echoParams=all';

     var parsedSolrUrl = solrUrlSvc.parseSolrUrl(urlStr);
     solrUrlSvc.removeUnsupported(parsedSolrUrl.solrArgs);
     expect(Object.keys(parsedSolrUrl.solrArgs)).not.toContain('json.wrf');
     expect(Object.keys(parsedSolrUrl.solrArgs)).not.toContain('facet');
     expect(Object.keys(parsedSolrUrl.solrArgs)).not.toContain('facet.field');
     expect(Object.keys(parsedSolrUrl.solrArgs)).not.toContain('rows');
     expect(Object.keys(parsedSolrUrl.solrArgs)).not.toContain('debug');
     expect(Object.keys(parsedSolrUrl.solrArgs)).not.toContain('fl');
     expect(Object.keys(parsedSolrUrl.solrArgs)).not.toContain('hl');
     expect(Object.keys(parsedSolrUrl.solrArgs)).not.toContain('hl.simple.pre');
     expect(Object.keys(parsedSolrUrl.solrArgs)).not.toContain('hl.simple.post');

    });

    it('parses solr url', function() {
      var urlStr = 'http://localhost:8983/solr/collection1/select?q=*:*';

      var parsedSolrUrl = solrUrlSvc.parseSolrUrl(urlStr);
      expect(parsedSolrUrl.protocol).toEqual('http:');
      expect(parsedSolrUrl.host).toEqual('localhost:8983');
      expect(parsedSolrUrl.collectionName).toEqual('collection1');
      expect(parsedSolrUrl.requestHandler).toEqual('select');
      expect(parsedSolrUrl.solrArgs.q).toContain('*:*');
    });

    it('adds a missing protocol to solr url', function() {
      var urlStr = 'localhost:8983/solr/collection1/select?q=*:*';

      var parsedSolrUrl = solrUrlSvc.parseSolrUrl(urlStr);
      expect(parsedSolrUrl.protocol).toEqual('http:');
      expect(parsedSolrUrl.host).toEqual('localhost:8983');
      expect(parsedSolrUrl.collectionName).toEqual('collection1');
      expect(parsedSolrUrl.requestHandler).toEqual('select');
      expect(parsedSolrUrl.solrArgs.q).toContain('*:*');
    });

    it('doesnt warn on group arguments', function() {
      var urlStr = 'http://localhost:8983/solr/collection1/select?group=true&group.main=true&group.field=text&q=*:*';
      var parsedSolrUrl = solrUrlSvc.parseSolrUrl(urlStr);
      var warnings = solrUrlSvc.removeUnsupported(parsedSolrUrl.solrArgs);
      expect(warnings.hasOwnProperty('group')).toBeFalsy();
    });

    it('keeps group arguments', function() {
      var urlStr = 'http://localhost:8983/solr/collection1/select?group=true&group.main=true&group.field=text&q=*:*';
      var parsedSolrUrl = solrUrlSvc.parseSolrUrl(urlStr);
      solrUrlSvc.removeUnsupported(parsedSolrUrl.solrArgs);
      expect(Object.keys(parsedSolrUrl.solrArgs)).toContain('group');
      expect(Object.keys(parsedSolrUrl.solrArgs)).toContain('group.main');
    });

    it('parses local params', function() {
      var urlStr = 'http://localhost:8983/solr/collection1/select?q={!term%20f=title}java';
      var parsedSolrUrl = solrUrlSvc.parseSolrUrl(urlStr);
      expect(parsedSolrUrl.solrArgs.q).toContain('{!term f=title}java');
      expect(parsedSolrUrl.solrArgs.q.length).toBe(1);

      urlStr = 'http://localhost:8983/solr/collection1/select?q={!term%20f=title bf=\'\'}java';
      parsedSolrUrl = solrUrlSvc.parseSolrUrl(urlStr);
      expect(parsedSolrUrl.solrArgs.q).toContain('{!term f=title bf=\'\'}java');
      expect(parsedSolrUrl.solrArgs.q.length).toBe(1);
    });

    it('parses Renes Solr URL', function() {
      var urlStr = 'http://localhost:8080/la-solr/tt/select?q=*:*';
      var parsedSolrUrl = solrUrlSvc.parseSolrUrl(urlStr);
      expect(parsedSolrUrl.protocol).toEqual('http:');
      expect(parsedSolrUrl.host).toEqual('localhost:8080');
      expect(parsedSolrUrl.collectionName).toEqual('tt');
      expect(parsedSolrUrl.requestHandler).toEqual('select');
      expect(parsedSolrUrl.solrArgs.q).toContain('*:*');
    });
  });

  describe('build URL', function() {
    it('adds a missing protocol when building asolr url', function() {
      var url = solrUrlSvc.buildUrl('www.example.com', {a: 'b', c: 'd'});
      expect(url).toEqual('http://www.example.com?a=b&c=d');
    });
  });

  describe('escape user query', function() {
    it('escapes user queries', function() {
      var escaped = solrUrlSvc.escapeUserQuery('+-&!()[]{}^"~?:\\');
      expect(escaped).toBe('\\+\\-\\&\\!\\(\\)\\[\\]\\{\\}\\^\\"\\~\\?\\:\\\\');
    });

    it('escapes boolean operators', function() {
      var escaped = solrUrlSvc.escapeUserQuery('the best and or the worst');
      expect(escaped).toBe('the best \\\\and \\\\or the worst');
      escaped = solrUrlSvc.escapeUserQuery('the bestand orthe worst');
      expect(escaped).toBe('the bestand orthe worst');
      escaped = solrUrlSvc.escapeUserQuery('and the bestand orthe worst');
      expect(escaped).toBe('\\\\and the bestand orthe worst');
      escaped = solrUrlSvc.escapeUserQuery('or the bestand orthe worst');
      expect(escaped).toBe('\\\\or the bestand orthe worst');
      escaped = solrUrlSvc.escapeUserQuery('or the bestand orthe worst and');
      expect(escaped).toBe('\\\\or the bestand orthe worst \\\\and');
      escaped = solrUrlSvc.escapeUserQuery('or the bestand orthe worst or');
      expect(escaped).toBe('\\\\or the bestand orthe worst \\\\or');
      escaped = solrUrlSvc.escapeUserQuery('o+r the bestand orthe worst or');
      expect(escaped).toBe('o\\+r the bestand orthe worst \\\\or');
      escaped = solrUrlSvc.escapeUserQuery('and          or       ');
      expect(escaped).toBe('\\\\and          \\\\or       ');
    });
  });

  describe('solr args parse/format', function() {

    var formatThenParse = function(solrArgs) {
      var formatted = solrUrlSvc.formatSolrArgs(solrArgs);
      return solrUrlSvc.parseSolrArgs(formatted);
    };

    var solrArgsEqual = function(args1, args2) {
      angular.forEach(args1, function(values, key) {
        expect(args2.hasOwnProperty(key));
        var values2 = args2[key];
        expect(values).toEqual(values2);
      });
    };

    it('formats/parses basic', function() {
      var solrArgs = {q: ['*:*'], fq: ['title:bar', 'text:foo']};
      var parsedBack = formatThenParse(solrArgs);
      solrArgsEqual(solrArgs, parsedBack);
    });

  });
});

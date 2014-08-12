'use strict';
/*global describe,beforeEach,inject,it,expect*/
describe('Service: solrUrlSvc', function () {
 
  beforeEach(module('o19s.splainer-search'));
  
  var solrUrlSvc = null; 
  beforeEach(inject(function (_solrUrlSvc_) {
    solrUrlSvc = _solrUrlSvc_;
  }));
  
  
  it('parses solr args', function() {
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
  
  it('parses solr url', function() {
    var urlStr = 'http://localhost:8983/solr/collection1/select?q=*:*';

    var parsedSolrUrl = solrUrlSvc.parseSolrUrl(urlStr);
    expect(parsedSolrUrl.protocol).toEqual('http:');
    expect(parsedSolrUrl.host).toEqual('localhost:8983');
    expect(parsedSolrUrl.collectionName).toEqual('collection1');
    expect(parsedSolrUrl.requestHandler).toEqual('select');
    expect(parsedSolrUrl.solrArgs.q).toContain('*:*');
  });
  
  it('warns on group arguments', function() {
    var urlStr = 'http://localhost:8983/solr/collection1/select?group=true&group.main=true&group.field=text&q=*:*';
    var parsedSolrUrl = solrUrlSvc.parseSolrUrl(urlStr);
    var warnings = solrUrlSvc.removeUnsupported(parsedSolrUrl.solrArgs);
    console.log(warnings);
    expect(warnings.group.length).toBeGreaterThan(1);
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

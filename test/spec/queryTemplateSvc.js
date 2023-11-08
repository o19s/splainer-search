'use strict';
/*global describe,beforeEach,inject,it,expect*/
describe('Service: queryTemplateSvc', function () {

  beforeEach(module('o19s.splainer-search'));

  var queryTemplateSvc = null;
  beforeEach(inject(function (_queryTemplateSvc_) {
    queryTemplateSvc = _queryTemplateSvc_;
  }));

  describe('parse args', function() {
    fit('parses solr args correctly', function() {
      
      var queryText = 'rambo movie';
      var template  = {
        "query": "#$query##"
      }
      
      template = JSON.stringify(template)
      
      var replaced = queryTemplateSvc.hydrate(template, queryText, {encodeURI: false, defaultKw: '\\"\\"'});
      
      replaced = angular.fromJson(replaced)
      
      var expectedReplaced = {
        query: "rambo movie"
      }
            
      expect(replaced).toEqual(expectedReplaced);
    });

  });
});

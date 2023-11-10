'use strict';
/*global describe,beforeEach,inject,it,expect*/
describe('Service: queryTemplateSvc', function () {

  beforeEach(module('o19s.splainer-search'));

  var queryTemplateSvc = null;
  beforeEach(inject(function (_queryTemplateSvc_) {
    queryTemplateSvc = _queryTemplateSvc_;
  }));

  describe('parse simple query template', function() {
    it('parses solr style GET params correctly', function() {
      
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
    
    fit('parses vectara style query', function() {
      
      var queryText = 'rambo movie';
      
      var qOption = {
        customerId: 123456789,
        "corpusId": 1        
      };
      
      
      var template =  {
        "query": [
          {
            "query": "#$query##",
            "start": 0,
            "numResults": 10,
            "corpusKey": [{
              "customerId": "#$qOption['customerId']##",
              "corpusId": "#$qOption['corpusId']##",
              "lexicalInterpolationConfig": {
                 "lambda": 0.025
               },
              "dim": []
            }]
          }
        ]
      }
      
      template = JSON.stringify(template)
      
      var replaced = queryTemplateSvc.hydrate(template, queryText, {qOption: qOption, encodeURI: false, defaultKw: '\\"\\"'});
      
      replaced = angular.fromJson(replaced)
      
      var expectedReplaced = {
        "query": [
          {
            "query": "rambo movie",
            "start": 0,
            "numResults": 10,
            "corpusKey": [{
              "customerId": "123456789",
              "corpusId": "1",
              "lexicalInterpolationConfig": {
                 "lambda": 0.025
               },
              "dim": []
            }]
          }
        ]
      }
            
      expect(replaced).toEqual(expectedReplaced);
    });     
  });
});

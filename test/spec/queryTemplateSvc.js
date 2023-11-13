'use strict';
/*global describe,beforeEach,inject,it,expect*/
describe('Service: queryTemplateSvc', function () {

  beforeEach(module('o19s.splainer-search'));

  var queryTemplateSvc = null;
  beforeEach(inject(function (_queryTemplateSvc_) {
    queryTemplateSvc = _queryTemplateSvc_;
  }));

  describe('parse query template', function() {
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


    it('replaces hierarchically in query objects and passes through types of values', function() {
      
      var queryText = 'rambo movie';
      
      var qOption = {
        customerId: 123456789,
        corpusId: 1,
        dims: [
          { name: "customDim1", weight: 0.8 },
          { name: "customDim2", weight: 0.6 }
        ]
      };

      var template =  {
        "query": [
          {
            "query": "#$query##",
            "start": 0,
            "numResults": 10,
            "corpusKey": [{
              "customerId": "#$qOption.customerId##",
              "corpusId": "#$qOption.corpusId##",
              "lexicalInterpolationConfig": {
                 "lambda": 0.025
               },
              "dim": "#$qOption.dims##"
            }]
          }
        ]
      }
      
      var replaced = queryTemplateSvc.hydrate(template, queryText, {qOption: qOption, encodeURI: false, defaultKw: '\\"\\"'});
      
      var expectedReplaced = {
        "query": [
          {
            "query": "rambo movie",
            "start": 0,
            "numResults": 10,
            "corpusKey": [{
              "customerId": 123456789,
              "corpusId": 1,
              "lexicalInterpolationConfig": {
                 "lambda": 0.025
               },
              "dim": [{ name: "customDim1", weight: 0.8 }, { name: "customDim2", weight: 0.6 }]
            }]
          }
        ]
      }
            
      expect(replaced).toEqual(expectedReplaced);
    });

    it('supports old keywords parameters, 0-index based array access and default values', function() {

      var queryText = 'rambo movie';
      var template  = {
        "query": "#$keyword1## and #$keyword.1## and #$keyword3|other##"
      }

      template = JSON.stringify(template)

      var replaced = queryTemplateSvc.hydrate(template, queryText, {encodeURI: false, defaultKw: '\\"\\"'});

      replaced = angular.fromJson(replaced)

      var expectedReplaced = {
        query: "rambo and movie and other"
      }

      expect(replaced).toEqual(expectedReplaced);
    });

  });


});

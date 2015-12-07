'use strict';

// Factory for explains
// really ties the room together
angular.module('o19s.splainer-search')
  .service('explainSvc', [
    'baseExplainSvc',
    'queryExplainSvc',
    'simExplainSvc',
    function explainSvc(baseExplainSvc, queryExplainSvc, simExplainSvc) {

      var Explain = baseExplainSvc.Explain;
      var ConstantScoreExplain = queryExplainSvc.ConstantScoreExplain;
      var MatchAllDocsExplain = queryExplainSvc.MatchAllDocsExplain;
      var WeightExplain = queryExplainSvc.WeightExplain;
      var FunctionQueryExplain = queryExplainSvc.FunctionQueryExplain;
      var DismaxTieExplain = queryExplainSvc.DismaxTieExplain;
      var DismaxExplain = queryExplainSvc.DismaxExplain;
      var SumExplain = queryExplainSvc.SumExplain;
      var CoordExplain = queryExplainSvc.CoordExplain;
      var ProductExplain = queryExplainSvc.ProductExplain;

      var FieldWeightExplain = simExplainSvc.FieldWeightExplain;
      var QueryWeightExplain = simExplainSvc.QueryWeightExplain;
      var DefaultSimTfExplain = simExplainSvc.DefaultSimTfExplain;
      var DefaultSimIdfExplain = simExplainSvc.DefaultSimIdfExplain;
      var ScoreExplain = simExplainSvc.ScoreExplain;

      var meOrOnlyChild = function(explain) {
        var infl = explain.influencers();
        if (infl.length === 1) {
          return infl[0]; //only child
        } else {
          return explain;
        }
      };

      var replaceBadJson = function(explJson) {
        var explJsonIfBad = {
          details: [],
          description: 'no explain for doc',
          value: 0.0,
          match: true
        };
        if (!explJson) {
          return explJsonIfBad;
        } else {
          return explJson;
        }
      };

      var tieRegex = /max plus ([0-9.]+) times/;
      var createExplain = function(explJson) {
        explJson = replaceBadJson(explJson);
        var base = new Explain(explJson, createExplain);
        var description = explJson.description;
        var details = [];
        var tieMatch = description.match(tieRegex);
        if (explJson.hasOwnProperty('details')) {
          details = explJson.details;
        }
        if (description.startsWith('score(')) {
          ScoreExplain.prototype = base;
          return new ScoreExplain(explJson);
        }
        if (description.startsWith('tf(')) {
          DefaultSimTfExplain.prototype = base;
          return new DefaultSimTfExplain(explJson);
        }
        else if (description.startsWith('idf(')) {
          DefaultSimIdfExplain.prototype = base;
          return new DefaultSimIdfExplain(explJson);
        }
        else if (description.startsWith('fieldWeight')) {
          FieldWeightExplain.prototype = base;
          return new FieldWeightExplain(explJson);
        }
        else if (description.startsWith('queryWeight')) {
          QueryWeightExplain.prototype = base;
          return new QueryWeightExplain(explJson);
        }
        if (description.startsWith('ConstantScore')) {
          ConstantScoreExplain.prototype = base;
          return new ConstantScoreExplain(explJson);
        }
        else if (description.startsWith('MatchAllDocsQuery')) {
          MatchAllDocsExplain.prototype = base;
          return new MatchAllDocsExplain(explJson);
        }
        else if (description.startsWith('weight(')) {
          WeightExplain.prototype = base;
          return new WeightExplain(explJson);
        }
        else if (description.startsWith('FunctionQuery')) {
          FunctionQueryExplain.prototype = base;
          return new FunctionQueryExplain(explJson);
        }
        else if (tieMatch && tieMatch.length > 1) {
          var tie = parseFloat(tieMatch[1]);
          DismaxTieExplain.prototype = base;
          return new DismaxTieExplain(explJson, tie);
        }
        else if (description.hasSubstr('max of')) {
          DismaxExplain.prototype = base;
          return meOrOnlyChild(new DismaxExplain(explJson));
        }
        else if (description.hasSubstr('sum of')) {
          SumExplain.prototype = base;
          return meOrOnlyChild(new SumExplain(explJson));
        }
        else if (description.hasSubstr('product of')) {
          var coordExpl = null;
          if (details.length === 2) {
            angular.forEach(details, function(detail) {
              if (detail.description.startsWith('coord(')) {
                CoordExplain.prototype = base;
                coordExpl = new CoordExplain(explJson, parseFloat(detail.value));
              }
            });
          }
          if (coordExpl !== null) {
            return coordExpl;
          } else {
            ProductExplain.prototype = base;
            return meOrOnlyChild(new ProductExplain(explJson));
          }
        }
        return base;

      };

      this.createExplain = function(explJson) {
        return createExplain(explJson);
      };
    }
  ]);

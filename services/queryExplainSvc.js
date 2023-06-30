'use strict';

// Explains that exist before you get to the match level
angular.module('o19s.splainer-search')
  .service('queryExplainSvc', [
    'baseExplainSvc',
    'vectorSvc',
    'simExplainSvc',
    function explainSvc(baseExplainSvc, vectorSvc, simExplainSvc) {
      var DefaultSimilarityMatch = simExplainSvc.DefaultSimilarityMatch;

      this.MatchAllDocsExplain = function() {
        this.realExplanation = 'Match All Docs (*:*)';
      };

      this.ConstantScoreExplain = function() {
        this.realExplanation = 'Constant Scored Query';
      };

      this.EsFuncWeightExplain = function(explJson) {
        this.realExplanation = 'f( -- constant weight -- ) = ' + explJson.value;
      };

      var shallowArrayCopy = function(src) {
        return src.slice(0);
      };


      this.WeightExplain = function(explJson) {
        // take weight(text:foo in 1234), extract text:foo,
        // this actually deliniates a "match" so the stuff
        // underneath this level in the explain is search nerd trivia
        // tf, idf, norms, etc.
        // We break that out separately, not part of the main explain
        // tree, but as a different hiererarchy
        var weightRegex = /^weight\((?!FunctionScoreQuery).*/;
        var description = explJson.description;
        
        var match = description.match(weightRegex);
        if (match !== null && match.length > 1) {
          this.realExplanation = match[1];
        } else {
          this.realExplanation = description;
          var prodOf = ', product of:';
          if (description.endsWith(prodOf)) {
            var len = description.length - prodOf.length;
            this.realExplanation = description.substring(0, len);
          }
        }

        this.hasMatch = function() {
          return true;
        };

        this.getMatch = function() {
          // Match has lots of goodies based on similarity used
          if (this.description.hasSubstr('DefaultSimilarity')) {
            return new DefaultSimilarityMatch(this.children);
          }
          return null;
        };

        this.explanation = function() {
          var match = this.getMatch();
          var matchStr = '';
          if (match !== null) {
            matchStr = '\n' + match.formulaStr();
          }
          return this.realExplanation;
        };

        this.matchDetails = function() {
          var rVal = {};
          rVal[this.explanation()] = this.rawStr(); //match.formulaStr();
          return rVal;
        };
      };

      this.FunctionQueryExplain = function(explJson) {
        var funcQueryRegex = /FunctionQuery\((.*)\)/;
        var description = explJson.description;
        var match = description.match(funcQueryRegex);
        if (match !== null && match.length > 1) {
          this.realExplanation = match[1];
        } else {
          this.realExplanation = description;
        }
      };

      this.EsFieldFunctionQueryExplain = function(explJson) {
        var funcQueryRegex = /Function for field (.*?):/;
        var description = explJson.description;
        var match = description.match(funcQueryRegex);
        var fieldName = 'unknown';
        if (match !== null && match.length > 1) {
          fieldName = match[1];
        }
        var explText = 'f(' + fieldName + ') = ';
        angular.forEach(this.children, function(child) {
          explText += child.description + ' ';
        });
        this.realExplanation = explText;

      };

      this.MinExplain = function() {
        this.realExplaination = 'Minimum Of:';

        this.influencers = function() {
          var infl = shallowArrayCopy(this.children);
          infl.sort(function(a, b) {return a.score - b.score;});
          return [infl[0]];
        };

        this.vectorize = function() {
          // pick the minimum, which is sorted by influencers
          var infl = this.influencers();
          var minInfl = infl[0];
          return minInfl.vectorize();
          };
      };

      this.CoordExplain = function(explJson, coordFactor) {
        if (coordFactor < 1.0) {
          this.realExplanation = 'Matches Punished by ' + coordFactor + ' (not all query terms matched)';

          this.influencers = function() {
            var infl = [];
            for (var i = 0; i < this.children.length; i++) {
              if (this.children[i].description.hasSubstr('coord')) {
                continue;
              } else {
                infl.push(this.children[i]);
              }
            }
            return infl;
          };

          this.vectorize = function() {
            // scale the others by coord factor
            var rVal = vectorSvc.create();
            angular.forEach(this.influencers(), function(infl) {
              rVal = vectorSvc.add(rVal, infl.vectorize());
            });
            rVal = vectorSvc.scale(rVal, coordFactor);
            return rVal;
          };
        }
      };

      this.DismaxTieExplain = function(explJson, tie) {
        this.realExplanation = 'Dismax (max plus:' + tie + ' times others)';

        this.influencers = function() {
          var infl = shallowArrayCopy(this.children);
          infl.sort(function(a, b) {return b.score - a.score;});
          return infl;
        };

        this.vectorize = function() {
          var infl = this.influencers();
          // infl[0] is the winner of the dismax competition
          var rVal = infl[0].vectorize();
          angular.forEach(infl.slice(1), function(currInfl) {
            var vInfl = currInfl.vectorize();
            var vInflScaled = vectorSvc.scale(vInfl, tie);
            rVal = vectorSvc.add(rVal, vInflScaled);
          });
          return rVal;
        };
      };


      this.DismaxExplain = function() {
        this.realExplanation = 'Dismax (take winner of below)';

        this.influencers = function() {
          var infl = shallowArrayCopy(this.children);
          infl.sort(function(a, b) {return b.score - a.score;});
          return infl;
        };

        this.vectorize = function() {
          var infl = this.influencers();
          // Dismax, winner takes all, influencers
          // are sorted by influence
          return infl[0].vectorize();
        };
      };

      this.SumExplain = function() {
        this.realExplanation = 'Sum of the following:';
        this.isSumExplain = true;

        this.influencers = function() {
          // Well then the child is the real influencer, we're taking sum
          // of one thing
          var infl = [];
          angular.forEach(this.children, function(child) {
            // take advantage of commutative property
            if (child.hasOwnProperty('isSumExplain') && child.isSumExplain) {
              angular.forEach(child.influencers(), function(grandchild) {
                infl.push(grandchild);
              });
            } else {
              infl.push(child);
            }
          });
          return infl.sort(function(a, b) {return b.score - a.score;});
        };

        this.vectorize = function() {
          // vector sum all the components
          var rVal = vectorSvc.create();
          angular.forEach(this.influencers(), function(infl) {
            rVal = vectorSvc.sumOf(rVal, infl.vectorize());
          });
          return rVal;
        };
      };

      this.ProductExplain = function() {
        this.realExplanation = 'Product of following:';

        var oneFilled = function(length) {
          return Array.apply(null, new Array(length)).map(Number.prototype.valueOf,1);
        };

        this.influencers = function() {
          var infl = shallowArrayCopy(this.children);
          infl.sort(function(a, b) {return b.score - a.score;});
          return infl;
        };
        this.vectorize = function() {
          // vector sum all the components
          var rVal = vectorSvc.create();

          var infl = this.influencers();

          var inflFactors = oneFilled(infl.length);

          for (var factorInfl = 0; factorInfl < infl.length; factorInfl++) {
            for (var currMult = 0; currMult < infl.length; currMult++) {
              if (currMult !== factorInfl) {
                inflFactors[factorInfl] = (inflFactors[factorInfl] * infl[currMult].contribution());
              }
            }
          }

          for (var currInfl = 0; currInfl < infl.length; currInfl++) {
            var i = infl[currInfl];
            var thisVec = i.vectorize();
            var thisScaledByOthers = vectorSvc.scale(thisVec, inflFactors[currInfl]);
            rVal = vectorSvc.add(rVal, thisScaledByOthers);
          }

          return rVal;
        };
      };

    }
  ]);

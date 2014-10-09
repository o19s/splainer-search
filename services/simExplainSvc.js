'use strict';

// Explains that exist below the match level
// these have a lot to do with the similarity implementation used by Solr/Lucene
// Here we implement default similarity, we will need to split this out for
// more similarity types (ie sweet spot, bm25) as needed
angular.module('o19s.splainer-search')
  .service('simExplainSvc', function explainSvc() {

    this.DefaultSimilarityMatch = function(children) {
      var infl = children;
      if (children.length === 1 && children[0].explanation().startsWith('Score')) {
        infl = children[0].children;
      }

      this.fieldWeight = null;
      this.queryWeight = null;
      var match = this;
      angular.forEach(infl, function(child) {
        if (child.explanation() === 'Field Weight') {
          match.fieldWeight = child;
        } else if (child.explanation() === 'Query Weight') {
          match.queryWeight = child;
        }
      });

      this.formulaStr = function() {
        return 'TF=' + this.fieldWeight.tf().contribution() + 
               ' * IDF=' + this.fieldWeight.idf().contribution();
      };
    };

    var tfIdfable = function(explain) {
      var tfExpl = null;
      var idfExpl = null;
      angular.forEach(explain.children, function(child) {
        if (child.explanation().startsWith('Term')) {
          tfExpl = child;
        } else if (child.explanation().startsWith('IDF')) {
          idfExpl = child;
        }
      });

      explain.tf = function() {
        return tfExpl;
      };
      
      explain.idf = function() {
        return idfExpl;
      };
      return explain;
    };

    this.ScoreExplain = function() {
      this.realExplanation = 'Score';
    };

    this.FieldWeightExplain = function() {
      this.realExplanation = 'Field Weight';
      tfIdfable(this);

      /*this.fieldNorm = function() {
      };*/
    };
    
    this.QueryWeightExplain = function() {
      this.realExplanation = 'Query Weight';
      tfIdfable(this);
    };

    // For default similarity, tf in the score is actually
    // is sqrt(termFreq) where termFreq is the frequency of
    // a term in a document.
    this.DefaultSimTfExplain = function() {

      // Should have a single child with actual term frequency
      // Notes TODO:
      // 1. For strict phrase queries, ie "one two" this is
      //    phraseFreq, not a big deal just labeling
      // 2. For sloppy phrase queries gets more complicated,
      //     sloppyFreq is (1 / (distance + 1))
      //      where distance min distance in doc between "one ... two"
      //      for every set of phrases in document
      var termFreq = this.children[0].contribution();
      this.realExplanation = 'Term Freq Score (' + termFreq + ')';
    };

    // For default similarity, IDF of the term being searched
    // in the case of phrase queries, this is a sum of
    // all the members of the phrase. 
    //
    // TODO -- the underlying idf for each member of a phrase
    // does not identify the term corresponding to that idf,
    // Lucene patch?
    //
    // The formula for IDF in default similarity is
    //  1 + log( numDocs / (docFreq + 1))
    //
    // or taken the idf explanation:
    //   idf(docFreq=4743, maxDocs=20148)
    // in python:
    // >> 1 + log(20148.0 / (4753 + 1))
    //
    this.DefaultSimIdfExplain = function(explJson) {
      var desc = explJson.description;
      if (this.children.length > 1 && desc.hasSubstr('sum of:')) {
        // then each child is an idf explain
        this.realExplanation = 'IDF Score';
        this.influencers = function() {
          return this.children;
        };
      }
      else {
        var idfRegex = /idf\(docFreq=(\d+),.*maxDocs=(\d+)\)/;
        var matches = desc.match(idfRegex);
        if (matches !== null && matches.length > 1) {
          /*var docFreq = parseInt(matches[1], 10);
          var maxDocs = parseInt(matches[2], 10);*/
          this.realExplanation = 'IDF Score';
        }
        else {
          this.realExplanation = desc;
        }
      }
    };
});

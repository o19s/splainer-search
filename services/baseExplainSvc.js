'use strict';

// Executes a solr search and returns
// a set of queryDocs
angular.module('o19s.splainer-search')
  .service('baseExplainSvc', [
    'vectorSvc',
    function explainSvc(vectorSvc) {

      this.Explain = function(explJson, explFactory) {
        var datExplain = this;
        this.asJson = explJson;
        this.realContribution = this.score = parseFloat(explJson.value);
        this.realExplanation = this.description = explJson.description;
        var details = [];
        if (explJson.hasOwnProperty('details')) {
          details = explJson.details;
        }
        this.children = [];
        angular.forEach(details, function(detail) {
          datExplain.children.push(explFactory(detail));
        });

        /* Each explain defines influencers,
         *
         * whatever this explain feels should be
         * plucked out of the explJson passed in as a list
         * of things that explain it
         * */
        this.influencers = function() {
          return [];
        };

        /* Each explain reports its contribution
         * */
        this.contribution = function() {
          return this.realContribution;
        };

        /* Each explain reports a more human-readable form
         * of the explain text that hopefully is less search geeky
         * */
        this.explanation = function() {
          return this.realExplanation;
        };

        /* Once we get to "matches" we intend to
         * stop, and the level below becomes heavily related to
         * similarity implementations (how does the tf * idf calculation work)
         * we'll call that out seperately to keep things sane
         * */
        this.hasMatch = function() {
          return false;
        };

        /* Return my influencers as a vector
         * where magnitude of each dimension is how
         * much I am influenced by that influencer
         *
         * IE if I am a SumExplain, my vector is likely to be
         * for matches x and y with scores a and y respectively
         *
         *  a * x + b * y
         *
         *  here a and b are constants, x and y are other
         *  matches to be recursively expanded
         *
         * */
        this.vectorize = function() {
          var rVal = vectorSvc.create();
          // base vector is just a, no expansion farther down
          // so any children's expansion will get ignored
          rVal.set(this.explanation(), this.contribution());
          return rVal;
        };

        var mergeInto = function(sink, source) {
          for (var attrname in source) { sink[attrname] = source[attrname]; }
          return sink;
        };
        this.matchDetails = function() {
          var rVal = {};
          angular.forEach(this.children, function(child) {
            mergeInto(rVal, child.matchDetails());
          });
          return rVal;
        };

        /* A friendly, hiererarchical view
         * of all the influencers
         * */
        var asStr = '';
        var asRawStr = '';
        this.toStr = function(depth) {
          if (asStr === '') {
            if (depth === undefined) {
              depth = 0;
            }
            var prefix = new Array(2 * depth).join(' ');
            var me = prefix + this.contribution() + ' ' + this.explanation() + '\n';
            var childStrs = [];
            angular.forEach(this.influencers(), function(child) {
              childStrs.push(child.toStr(depth+1));
            });
            asStr = me + childStrs.join('\n');
          }
          return asStr;
        };

        this.rawStr = function() {
          /* global JSON */
          if (asRawStr === '') {
            asRawStr = JSON.stringify(this.asJson);
          }
          return asRawStr;
        };
      };
    }
  ]);

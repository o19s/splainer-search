'use strict';

angular.module('o19s.splainer-search')
  .service('osSearcherPreprocessorSvc', [
    function osSearcherPreprocessorSvc() {
      var self      = this;
      self.prepare  = prepare;


      function prepare (searcher) {
        console.log("In prepare")

      }
    }
  ]);

'use strict';

angular.module('o19s.splainer-search')
  .service('searchApiSearcherPreprocessorSvc', [

    function searchApiSearcherPreprocessorSvc() {
      var self      = this;
      self.prepare  = prepare;


      function prepare (searcher) {
        console.log("HI from prepare")
      }
    }
  ]);

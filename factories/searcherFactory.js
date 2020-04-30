'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('SearcherFactory', [SearcherFactory]);

  function SearcherFactory() {
    var Searcher = function(options, preprocessor) {
      var self                = this;

      self.fieldList          = options.fieldList;
      self.highlightFieldList = options.highlightFieldList;
      self.url                = options.url;
      self.args               = options.args;
      self.queryText          = options.queryText;
      self.config             = options.config;
      self.type               = options.type;

      self.docs               = [];
      self.grouped            = {};
      self.numFound           = 0;
      self.inError            = false;
      self.othersExplained    = {};

      self.HIGHLIGHTING_PRE   = options.HIGHLIGHTING_PRE;
      self.HIGHLIGHTING_POST  = options.HIGHLIGHTING_POST;

      preprocessor.prepare(self);
    };

    // Return factory object
    return Searcher;
  }
})();

'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('SearcherFactory', [SearcherFactory]);

  function SearcherFactory() {
    var Searcher = function(options, preprocessor) {
      var self                = this;

      // Methods that we expect all engines to provide
      self.fieldList          = options.fieldList;
      self.hlFieldList        = options.hlFieldList;
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
      self.parsedQueryDetails = {};

      self.HIGHLIGHTING_PRE   = options.HIGHLIGHTING_PRE;
      self.HIGHLIGHTING_POST  = options.HIGHLIGHTING_POST;

      preprocessor.prepare(self);
    };

    // Return factory object
    return Searcher;
  }
})();

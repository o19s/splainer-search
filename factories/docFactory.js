'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('DocFactory', [DocFactory]);

  function DocFactory() {
    var Doc = function(doc, options) {
      var self        = this;
      var theSource   = angular.copy(doc);

      // Copy over any attributes in the original doc.
      // This may not be needed, but is in there because previous version
      // was adding the functions from this factory to the original doc,
      // so because I am no sure about the consequences of leaving it out
      // I am copying the info, even though we have the source().
      // -YC
      angular.copy(doc, self);

      self.options    = options;

      self.source     = source;
      self.groupedBy  = groupedBy;
      self.group      = group;

      function source () {
        return theSource;
      }

      function groupedBy () {
        if (options.groupedBy === undefined) {
          return null;
        } else {
          return options.groupedBy;
        }
      }

      function group () {
        if (options.group === undefined) {
          return null;
        } else {
          return options.group;
        }
      }
    };

    // Return factory object
    return Doc;
  }
})();

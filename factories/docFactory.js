'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('DocFactory', [DocFactory]);

  function DocFactory() {
    var Doc = function(doc, options) {
      var self        = this;

      angular.copy(doc, self);

      self.options    = options;
      self.doc        = doc;

      self.groupedBy  = groupedBy;
      self.group      = group;

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

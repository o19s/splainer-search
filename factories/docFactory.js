'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('DocFactory', [DocFactory]);

  function DocFactory() {
    var Doc = function(doc, opts) {
      var self        = this;

      angular.copy(doc, self);

      self.doc             = doc;

      self.groupedBy       = groupedBy;
      self.group           = group;
      self.options         = options;
      self.version         = version;
      self.fieldsAttrName  = fieldsAttrName;
      self.fieldsProperty  = fieldsProperty;

      function groupedBy () {
        if (opts.groupedBy === undefined) {
          return null;
        } else {
          return opts.groupedBy;
        }
      }

      function options() {
        return opts;
      }

      function group () {
        if (opts.group === undefined) {
          return null;
        } else {
          return opts.group;
        }
      }

      function version () {
        if (opts.version === undefined) {
          return null;
        } else {
          return opts.version;
        }
      }

      function fieldsAttrName() {
        if ( 5 <= self.version() ) {
          if ( self.hasOwnProperty('_source') ) {
            return '_source';
          } else {
            return 'stored_fields';
          }
        } else {
          if ( self.hasOwnProperty('_source') ) {
            return '_source';
          } else {
            return 'fields';
          }
        }
      }

      function fieldsProperty() {
        return self[self.fieldsAttrName()];
      }
    };

    // Return factory object
    return Doc;
  }
})();

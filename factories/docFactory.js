'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('DocFactory', [DocFactory]);

  function DocFactory() {
    var Doc = function(doc, opts) {
      var self = this;
      angular.copy(doc, self);
      self.doc = doc;
      self.opts = opts;
    };

    Doc.prototype = {};
    Doc.prototype.groupedBy = groupedBy;
    Doc.prototype.group = group;
    Doc.prototype.options = options;
    Doc.prototype.version = version;
    Doc.prototype.fieldsAttrName = fieldsAttrName;
    Doc.prototype.fieldsProperty = fieldsProperty;

    function groupedBy() {
      /*jslint validthis:true*/
      var self = this;
      if (this.opts.groupedBy === undefined) {
        return null;
      } else {
        return this.opts.groupedBy;
      }
    }

    function options() {
      /*jslint validthis:true*/
      var self = this;
      return this.opts;
    }

    function group() {
      /*jslint validthis:true*/
      var self = this;
      if (this.opts.group === undefined) {
        return null;
      } else {
        return this.opts.group;
      }
    }

    function version() {
      /*jslint validthis:true*/
      var self = this;
      if (this.opts.version === undefined) {
        return null;
      } else {
        return this.opts.version;
      }
    }

    function fieldsAttrName() {
      return '_source';
    }

    function fieldsProperty() {
      /*jslint validthis:true*/
      var self = this;
      return self[self.fieldsAttrName()];
    }

    // Return factory object
    return Doc;
  }
})();

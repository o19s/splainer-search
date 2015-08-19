'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('EsDocFactory', [
      'DocFactory',
      EsDocFactory
    ]);

  function EsDocFactory(DocFactory) {
    var Doc = function(doc, options) {
      DocFactory.call(this, doc, options);

      var self = this;
      angular.forEach(self.fields, function(fieldValue, fieldName) {
        if (fieldValue.length === 1 && typeof(fieldValue) === 'object') {
          self[fieldName] = fieldValue[0];
        } else {
          self[fieldName] = fieldValue;
        }
      });
    };

    Doc.prototype = Object.create(DocFactory.prototype);
    Doc.prototype.constructor = Doc; // Reset the constructor

    Doc.prototype.url        = url;
    Doc.prototype.explain    = explain;
    Doc.prototype.snippet    = snippet;
    Doc.prototype.highlight  = highlight;

    function url () {
      return '#';
    }

    function explain () {
      /*jslint validthis:true*/
      var self = this;
      return self.options.explDict;
    }

    function snippet () {
      /*jslint validthis:true*/
      var self = this;
      return null;
    }

    function highlight (docId, fieldName, preText, postText) {
      /*jslint validthis:true*/
      var self = this;
      return self.options.hlDict;
    }

    return Doc;
  }
})();

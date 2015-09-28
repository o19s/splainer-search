'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('EsDocFactory', [
      'esUrlSvc',
      'DocFactory',
      EsDocFactory
    ]);

  function EsDocFactory(esUrlSvc, DocFactory) {
    var Doc = function(doc, options) {
      DocFactory.call(this, doc, options);

      var self = this;
      angular.forEach(self.fields, function(fieldValue, fieldName) {
        if ( fieldValue.length === 1 && typeof(fieldValue) === 'object' ) {
          self[fieldName] = fieldValue[0];
        } else {
          self[fieldName] = fieldValue;
        }
      });

      // Delete the highlight snippet because the normalized doc expect
      // `highlight` to be a function, not an object.
      // The highlight snippet is still available from `self.doc.highlight`.
      delete self.highlight;
    };

    Doc.prototype = Object.create(DocFactory.prototype);
    Doc.prototype.constructor = Doc; // Reset the constructor

    Doc.prototype.url        = url;
    Doc.prototype.explain    = explain;
    Doc.prototype.snippet    = snippet;
    Doc.prototype.source     = source;
    Doc.prototype.highlight  = highlight;

    function url () {
      /*jslint validthis:true*/
      var self  = this;
      var doc   = self.doc;
      var esurl = self.options().url;

      var uri = esUrlSvc.parseUrl(esurl);
      return esUrlSvc.buildDocUrl(uri, doc);
    }

    function explain () {
      /*jslint validthis:true*/
      var self = this;
      return self.options().explDict;
    }

    function snippet (docId, fieldName) {
      /*jslint validthis:true*/
      var self = this;

      if (self.doc.hasOwnProperty('highlight')) {
        var docHls = self.doc.highlight;
        if (docHls.hasOwnProperty(fieldName)) {
          return docHls[fieldName];
        }
      }
      return null;
    }

    function source () {
      /*jslint validthis:true*/
      var self = this;

      // Usually you would return _source, but since we are specifying the
      // fields to display, ES only returns those specific fields.
      // And we are assigning the fields to the doc itself in this case.
      return angular.copy(self);
    }

    function highlight (docId, fieldName, preText, postText) {
      /*jslint validthis:true*/
      var self        = this;
      var fieldValue  = self.snippet(docId, fieldName);

      if (fieldValue) {
        var newValue = [];
        angular.forEach(fieldValue, function (value) {
          // Doing the naive thing and assuming that the highlight tags
          // were not overridden in the query DSL.
          var preRegex  = new RegExp('<em>', 'g');
          var hlPre     = value.replace(preRegex, preText);
          var postRegex = new RegExp('</em>', 'g');

          newValue.push(hlPre.replace(postRegex, postText));
        });

        return newValue;
      } else {
        return null;
      }
    }

    return Doc;
  }
})();

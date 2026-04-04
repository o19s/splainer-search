'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('SolrDocFactory', [
      'DocFactory',
      'solrUrlSvc',
      'utilsSvc',
      SolrDocFactory
    ]);

  function SolrDocFactory(DocFactory, solrUrlSvc, utilsSvc) {
    var Doc = function(doc, options) {
      DocFactory.call(this, doc, options);
    };

    Doc.prototype = Object.create(DocFactory.prototype);
    Doc.prototype.constructor = Doc; // Reset the constructor


    Doc.prototype._url       = _url;
    Doc.prototype.explain    = explain;
    Doc.prototype.snippet    = snippet;
    Doc.prototype.origin     = origin;
    Doc.prototype.highlight  = highlight;

    var entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&#39;',
      '/': '&#x2F;'
    };

    var escapeHtml = function(string) {
      return String(string).replace(/[&<>"'/]/g, function (s) {
        return entityMap[s];
      });
    };

    /**
     * Escape a string so it can be used as a literal segment inside a RegExp pattern.
     * User-configured highlight markers may contain regex metacharacters (e.g. parentheses).
     * @param {string} string
     * @returns {string}
     */
    var escapeRegExp = function(string) {
      return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    /**
     *
     * Builds Solr URL for a single Solr document.
     */
    var buildDocUrl = function(fieldList, url, idField, docId) {
      // SUSS_USE_OF_ESCAPING.  Going to disable this and see what happens.
      //var escId = encodeURIComponent(solrUrlSvc.escapeUserQuery(docId));
      var escId = encodeURIComponent(docId);

      var urlArgs = {
        'indent': ['true'],
        'wt': ['json']
      };
      return solrUrlSvc.buildUrl(url, urlArgs) + '&q=' + idField + ':'  + escId;
    };

    function _url (idField, docId) {
      /*jslint validthis:true*/
      var self = this;
      return buildDocUrl(self.options().fieldList, self.options().url, idField, docId);
    }

    function explain (docId) {
      /*jslint validthis:true*/
      var self = this;

      if (Object.hasOwn(self.options().explDict, docId)) {
        return self.options().explDict[docId];
      } else {
        return null;
      }
    }

    function snippet (docId, fieldName) {
      /*jslint validthis:true*/
      var self = this;

      if (Object.hasOwn(self.options().hlDict, docId)) {
        var docHls = self.options().hlDict[docId];
        if (Object.hasOwn(docHls, fieldName)) {
          return docHls[fieldName];
        }
      }
      return null;
    }

    function origin () {
      /*jslint validthis:true*/
      var self = this;
      return utilsSvc.deepClone(self.doc);
    }

    function highlight (docId, fieldName, preText, postText) {
      /*jslint validthis:true*/
      var self        = this;
      var fieldValue  = self.snippet(docId, fieldName);
      var prePat;
      var postPat;

      if (fieldValue && fieldValue instanceof Array) {
        if ( fieldValue.length === 0 ) {
          return null;
        }

        var escapedValues = [];
        prePat  = escapeRegExp(self.options().highlightingPre);
        postPat = escapeRegExp(self.options().highlightingPost);

        utilsSvc.safeForEach(fieldValue, function(value) {
          var esc       = escapeHtml(value);
          var preRegex  = new RegExp(prePat, 'g');
          var hlPre     = esc.replace(preRegex, preText);
          var postRegex = new RegExp(postPat, 'g');
          var hlPost    = hlPre.replace(postRegex, postText);

          escapedValues.push(hlPost);
        });

        return escapedValues;
      } else if (fieldValue) {
        prePat = escapeRegExp(self.options().highlightingPre);
        postPat = escapeRegExp(self.options().highlightingPost);
        var esc       = escapeHtml(fieldValue);
        var preRegex  = new RegExp(prePat, 'g');
        var hlPre     = esc.replace(preRegex, preText);
        var postRegex = new RegExp(postPat, 'g');
        var hlPost    = hlPre.replace(postRegex, postText);

        return hlPost;
      } else {
        return null;
      }
    }

    return Doc;
  }
})();

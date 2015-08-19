'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('SolrDocFactory', [
      'DocFactory',
      'solrUrlSvc',
      SolrDocFactory
    ]);

  function SolrDocFactory(DocFactory, solrUrlSvc) {
    var Doc = function(doc, options) {
      DocFactory.call(this, doc, options);
    };

    Doc.prototype = Object.create(DocFactory.prototype);
    Doc.prototype.constructor = Doc; // Reset the constructor


    Doc.prototype.url        = url;
    Doc.prototype.explain    = explain;
    Doc.prototype.snippet    = snippet;
    Doc.prototype.highlight  = highlight;

    var entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '\"': '&quot;',
      '\'': '&#39;',
      '/': '&#x2F;'
    };

    var escapeHtml = function(string) {
      return String(string).replace(/[&<>"'\/]/g, function (s) {
        return entityMap[s];
      });
    };

    // a URL to access a the specified docId
    var buildTokensUrl = function(fieldList, solrUrl, idField, docId) {
      var escId = encodeURIComponent(solrUrlSvc.escapeUserQuery(docId));

      var tokensArgs = {
        'indent': ['true'],
        'wt': ['xml'],
        //'q': [idField + ':' + escId],
        'facet': ['true'],
        'facet.field': [],
        'facet.mincount': ['1'],
      };
      if (fieldList !== '*') {

        angular.forEach(fieldList, function(fieldName) {
          if (fieldName !== 'score') {
            tokensArgs['facet.field'].push(fieldName);
          }
        });
      }
      return solrUrlSvc.buildUrl(solrUrl, tokensArgs) + '&q=' + idField + ':'  + escId;
    };

    function url (idField, docId) {
      /*jslint validthis:true*/
      var self = this;
      return buildTokensUrl(self.options.fieldList, self.options.url, idField, docId);
    }

    function explain (docId) {
      /*jslint validthis:true*/
      var self = this;

      if (self.options.explDict.hasOwnProperty(docId)) {
        return self.options.explDict[docId];
      } else {
        return null;
      }
    }

    function snippet (docId, fieldName) {
      /*jslint validthis:true*/
      var self = this;

      if (self.options.hlDict.hasOwnProperty(docId)) {
        var docHls = self.options.hlDict[docId];
        if (docHls.hasOwnProperty(fieldName)) {
          return docHls[fieldName];
        }
      }
      return null;
    }

    function highlight (docId, fieldName, preText, postText) {
      /*jslint validthis:true*/
      var self        = this;
      var fieldValue  = self.snippet(docId, fieldName);

      if (fieldValue) {
        var esc       = escapeHtml(fieldValue);
        var preRegex  = new RegExp(self.options.highlightingPre, 'g');
        var hlPre     = esc.replace(preRegex, preText);
        var postRegex = new RegExp(self.options.highlightingPost, 'g');

        return hlPre.replace(postRegex, postText);
      } else {
        return null;
      }
    }

    return Doc;
  }
})();

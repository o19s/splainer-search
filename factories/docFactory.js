'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('DocFactory', ['solrUrlSvc', DocFactory]);

  function DocFactory(solrUrlSvc) {
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

      self.source     = source;
      self.groupedBy  = groupedBy;
      self.group      = group;
      self.url        = url;
      self.explain    = explain;
      self.snippet    = snippet;
      self.highlight  = highlight;

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

      function url (idField, docId) {
        return buildTokensUrl(options.fieldList, options.url, idField, docId);
      }

      function explain (docId) {
        if (options.explDict.hasOwnProperty(docId)) {
          return options.explDict[docId];
        } else {
          return null;
        }
      }

      function snippet (docId, fieldName) {
        if (options.hlDict.hasOwnProperty(docId)) {
          var docHls = options.hlDict[docId];
          if (docHls.hasOwnProperty(fieldName)) {
            return docHls[fieldName];
          }
        }
        return null;
      }

      function highlight (docId, fieldName, preText, postText) {
        var fieldValue = self.snippet(docId, fieldName);

        if (fieldValue) {
          var esc       = escapeHtml(fieldValue);
          var preRegex  = new RegExp(options.highlightingPre, 'g');
          var hlPre     = esc.replace(preRegex, preText);
          var postRegex = new RegExp(options.highlightingPost, 'g');

          return hlPre.replace(postRegex, postText);
        } else {
          return null;
        }
      }
    };

    // Return factory object
    return Doc;
  }
})();

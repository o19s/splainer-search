'use strict';

// Deals with normalizing documents from solr
// into a canonical representation, ie
// each doc has an id, a title, possibly a thumbnail field
// and possibly a list of sub fields
angular.module('o19s.splainer-search')
  .service('normalDocsSvc', function normalDocsSvc(explainSvc) {
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

    var assignSingleField = function(normalDoc, solrDoc, solrField, toProperty) {
      if (solrDoc.hasOwnProperty(solrField)) {
        normalDoc[toProperty] = ('' + solrDoc[solrField]);
      }
    };

    var assignFields = function(normalDoc, solrDoc, fieldSpec) {
      assignSingleField(normalDoc, solrDoc, fieldSpec.id, 'id');
      assignSingleField(normalDoc, solrDoc, fieldSpec.title, 'title');
      assignSingleField(normalDoc, solrDoc, fieldSpec.thumb, 'thumb');
      normalDoc.subs = {};
      if (fieldSpec.subs === '*') {
        angular.forEach(solrDoc, function(value, fieldName) {
          if (typeof(value) !== 'function') {
            if (fieldName !== fieldSpec.id && fieldName !== fieldSpec.title &&
                fieldName !== fieldSpec.thumb) {
              normalDoc.subs[fieldName] = '' + value;
            }
          }
        });
      }
      else {
        angular.forEach(fieldSpec.subs, function(subFieldName) {
          if (solrDoc.hasOwnProperty(subFieldName)) {
            normalDoc.subs[subFieldName] = '' + solrDoc[subFieldName];
          }
        });
      }
    };

    // A document within a query
    var NormalDoc = function(fieldSpec, solrDoc) {
      this.solrDoc = solrDoc;
      assignFields(this, this.solrDoc.source(), fieldSpec);
      var hasThumb = false;
      if (this.hasOwnProperty('thumb')) {
        hasThumb = true;
      }
      this.subsList = [];
      var thisNormalDoc = this;
      angular.forEach(this.subs, function(subValue, subField) {
        var expanded = {field: subField, value: subValue};
        thisNormalDoc.subsList.push(expanded);
      });

      this.hasThumb = function() {
        return hasThumb;
      };
      
      this.url = function() {
        return this.solrDoc.url(fieldSpec.id, this.id);
      };

    };

    // layer on highlighting features
    var snippitable = function(doc) {
      var solrDoc = doc.solrDoc;
      
      var lastSubSnips = {};
      var lastHlPre = null;
      var lastHlPost = null;
      doc.subSnippets = function(hlPre, hlPost) {
        if (lastHlPre !== hlPre || lastHlPost !== hlPost) {
          angular.forEach(doc.subs, function(subFieldValue, subFieldName) {
            var snip = solrDoc.highlight(doc.id, subFieldName, hlPre, hlPost);
            if (snip === null) {
              snip = escapeHtml(subFieldValue.slice(0, 200));
            }
            lastSubSnips[subFieldName] = snip;
          });
        }
        return lastSubSnips;
      };
      return doc;
    };

    // layer on explain features
    var explainable = function(doc, explainJson) {

      var simplerExplain = null;// explainSvc.createExplain(explainJson);
      var hotMatches = null;//simplerExplain.vectorize();
      var matchDetails = null;

      var initExplain = function() {
        if (!simplerExplain) {
          simplerExplain = explainSvc.createExplain(explainJson);
          hotMatches = simplerExplain.vectorize();
          matchDetails = simplerExplain.matchDetails();
        }
      };

      doc.explain = function() {
        initExplain();
        return simplerExplain;
      };
      
      doc.hotMatches = function() {
        initExplain();
        return hotMatches;
      };

      doc.matchDetails = function() {
        initExplain();
        return matchDetails;
      };

      var hotOutOf = [];
      var lastMaxScore = -1;
      doc.hotMatchesOutOf = function(maxScore) {
        initExplain();
        if (maxScore !== lastMaxScore) {
          hotOutOf.length = 0;
        }
        lastMaxScore = maxScore;
        if (hotOutOf.length === 0) {
          angular.forEach(hotMatches.vecObj, function(value, key) {
            var percentage = ((0.0 + value) / maxScore) * 100.0;
            hotOutOf.push({description: key, metadata: matchDetails[key], percentage: percentage});
          });
          hotOutOf.sort(function(a,b) {return b.percentage - a.percentage;});
        }
        return hotOutOf;
      };

      doc.score = function() {
        initExplain();
        return simplerExplain.contribution();
      };
      return doc;
    };

    this.createNormalDoc = function(fieldSpec, solrDoc, altExplainJson) {
      var nDoc = new NormalDoc(fieldSpec, solrDoc);
      var explJson;
      if (altExplainJson) {
        explJson = altExplainJson;
      } else {
        explJson = solrDoc.explain(nDoc.id);
      }
      return this.snippetDoc(this.explainDoc(nDoc, explJson));
    };

    // Decorate doc with an explain/field values/etc other
    // than what came back from Solr
    this.explainDoc = function(doc, explainJson) {
      var decorated = angular.copy(doc);
      return explainable(decorated, explainJson);
    };

    this.snippetDoc = function(doc) {
      var decorated = angular.copy(doc);
      return snippitable(decorated);
    };

    // A stub, used to display a result that we expected 
    // to find in Solr, but isn't there
    this.createPlaceholderDoc = function(docId, stubTitle, explainJson) {
      var placeHolder = {id: docId,
                         title: stubTitle};
      if (explainJson) {
        return snippitable(explainable(placeHolder, explainJson));
      } else {
        placeHolder.subSnippets = function() {return '';};
        return placeHolder;
      }
    };

  
  });

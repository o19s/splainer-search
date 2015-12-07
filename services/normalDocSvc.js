'use strict';

// Deals with normalizing documents from the search engine
// into a canonical representation, ie
// each doc has an id, a title, possibly a thumbnail field
// and possibly a list of sub fields
angular.module('o19s.splainer-search')
  .service('normalDocsSvc', [
    'explainSvc',
    function normalDocsSvc(explainSvc) {
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

      var assignSingleField = function(normalDoc, doc, field, toProperty) {
        if (doc.hasOwnProperty(field)) {
          normalDoc[toProperty] = ('' + doc[field]);
        }
      };

      var assignFields = function(normalDoc, doc, fieldSpec) {
        assignSingleField(normalDoc, doc, fieldSpec.id, 'id');
        assignSingleField(normalDoc, doc, fieldSpec.title, 'title');
        assignSingleField(normalDoc, doc, fieldSpec.thumb, 'thumb');
        normalDoc.subs = {};
        if (fieldSpec.subs === '*') {
          angular.forEach(doc, function(value, fieldName) {
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
            if (doc.hasOwnProperty(subFieldName)) {
              normalDoc.subs[subFieldName] = '' + doc[subFieldName];
            }
          });
        }
      };

      // A document within a query
      var NormalDoc = function(fieldSpec, doc) {
        this.doc = doc;
        assignFields(this, this.doc.source(), fieldSpec);
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
          return this.doc.url(fieldSpec.id, this.id);
        };

      };

      // layer on highlighting features
      var snippitable = function(doc) {
        var aDoc = doc.doc;

        var lastSubSnips = {};
        var lastHlPre = null;
        var lastHlPost = null;
        doc.subSnippets = function(hlPre, hlPost) {
          if (lastHlPre !== hlPre || lastHlPost !== hlPost) {
            angular.forEach(doc.subs, function(subFieldValue, subFieldName) {
              var snip = aDoc.highlight(doc.id, subFieldName, hlPre, hlPost);
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

      var getDocExplain = function(doc, nDoc) {
        var explJson = doc.explain(nDoc.id);
        if (explJson === null) {
          if (doc.source().hasOwnProperty('id')) {
            return doc.explain(doc.source().id);
          }
        }
        return explJson;
      };

      this.createNormalDoc = function(fieldSpec, doc, altExplainJson) {
        var nDoc = new NormalDoc(fieldSpec, doc);
        var explJson;
        if (altExplainJson) {
          explJson = altExplainJson;
        } else {
          explJson = getDocExplain(doc, nDoc);
        }
        return this.snippetDoc(this.explainDoc(nDoc, explJson));
      };

      // Decorate doc with an explain/field values/etc other
      // than what came back from the search engine
      this.explainDoc = function(doc, explainJson) {
        return explainable(doc, explainJson);
      };

      this.snippetDoc = function(doc) {
        return snippitable(doc);
      };

      // A stub, used to display a result that we expected
      // to find, but isn't there
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
    }
  ]);

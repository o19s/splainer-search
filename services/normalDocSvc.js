'use strict';

// Deals with normalizing documents from solr
// into a canonical representation, ie
// each doc has an id, a title, possibly a thumbnail field
// and possibly a list of sub fields
angular.module('o19s.splainer-search')
  .service('normalDocsSvc', function normalDocsSvc(explainSvc) {

    var assignSingleField = function(normalDoc, solrDoc, solrField, toProperty) {
      if (solrDoc.hasOwnProperty(solrField)) {
        normalDoc[toProperty] = solrDoc[solrField].slice(0, 200);
      }
    };

    var assignSubField = function(normalDoc, solrDoc, subFieldName) {
        var hl = solrDoc.highlight(normalDoc.id, subFieldName);
        if (hl !== null) {
          normalDoc.subs[subFieldName] = hl;
        }
        else if (solrDoc.hasOwnProperty(subFieldName)) {
          normalDoc.subs[subFieldName] = solrDoc[subFieldName];
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
              assignSubField(normalDoc, solrDoc, fieldName);
            }
          }
        });
      }
      else {
        angular.forEach(fieldSpec.subs, function(subFieldName) {
          assignSubField(normalDoc, solrDoc, subFieldName);
        });
      }
    };

    // A document within a query
    var NormalDoc = function(fieldSpec, doc) {
      this.solrDoc = doc;
      assignFields(this, doc, fieldSpec);
      var hasThumb = false;
      if (this.hasOwnProperty('thumb')) {
        hasThumb = true;
      }
      this.subsList = [];
      var that = this;
      angular.forEach(this.subs, function(subValue, subField) {
        if (typeof(subValue) === 'string') {
          subValue = subValue.slice(0,200);
        }
        var expanded = {field: subField, value: subValue};
        that.subsList.push(expanded);
      });

      this.hasThumb = function() {
        return hasThumb;
      };
      
      this.url = function() {
        return this.solrDoc.url(fieldSpec.id, this.id);
      };
    };

    var explainable = function(doc, explainJson) {

      var simplerExplain = null;// explainSvc.createExplain(explainJson);
      var hotMatches = null;//simplerExplain.vectorize();

      var initExplain = function() {
        if (!simplerExplain) {
          simplerExplain = explainSvc.createExplain(explainJson);
          hotMatches = simplerExplain.vectorize();
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
            hotOutOf.push({description: key, percentage: percentage});
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

    this.createNormalDoc = function(fieldSpec, solrDoc) {
      var nDoc = new NormalDoc(fieldSpec, solrDoc);
      return this.explainDoc(nDoc, solrDoc.explain(nDoc.id));
    };

    // Decorate doc with an explain/field values/etc other
    // than what came back from Solr
    this.explainDoc = function(doc, explainJson) {
      var decorated = angular.copy(doc);
      return explainable(decorated, explainJson);
    };

    // A stub, used to display a result that we expected 
    // to find in Solr, but isn't there
    this.createPlaceholderDoc = function(docId, stubTitle) {
      return {id: docId,
              title: stubTitle};
    };

  
  });

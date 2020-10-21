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

      //
      // Takes an array of keys and fetches the nested value
      // by traversing the object map in parallel as the list of keys.
      //
      // @param obj,  Object, the object we want to fetch value from.
      // @param keys, Array,  the list of keys.
      //
      // Example:
      // obj:  { a: { b: 'c' } }
      // keys: [ 'a', 'b' ]
      // returns: obj['a']['b'] => c
      //
      var multiIndex = function(obj, keys) {
        if (keys.length === 0) {
          return obj;
        } else if (Array.isArray(obj)) {
          return obj.map(function(child) {
            return multiIndex(child, keys);
          });
        } else {
          return multiIndex(obj[keys[0]], keys.slice(1));
        }
      };

      //
      // Takes a key that has a dot in it, and tests if the name of the property includes
      // the dot, or if this is dot notation for traversing a nested object or array of objects.
      //
      // @param obj,  Object, the object we want to fetch value from.
      // @param keys, String, the dot notation of the keys.
      //
      // Example:
      // obj:  { a: { b: 'c' } }
      // keys: 'a.b'
      // returns: obj['a']['b'] => c
      //
      var pathIndex = function(obj, keys) {
        if (obj.hasOwnProperty(keys)){
          return obj[keys];
        }
        else {
          return multiIndex(obj, keys.split('.'));
        }
      };

      var assignSingleField = function(normalDoc, doc, field, toProperty) {
        if ( /\./.test(field) ) {
          try {
            var value = pathIndex(doc, field);
            normalDoc[toProperty] = '' + value;
          } catch (e) {
            normalDoc[toProperty] = '';
          }
        } else if ( doc.hasOwnProperty(field) ) {
          normalDoc[toProperty] = '' + doc[field];
        }
      };

      var fieldDisplayName = function(funcFieldQuery) {
        // to Solr this is sent as foo:$foo, we just want to display "foo"
        return funcFieldQuery.split(':')[0];
      };

      var assignEmbeds = function(normalDoc, doc, fieldSpec) {
        angular.forEach(fieldSpec.embeds, function (embedField) {
            normalDoc.embeds[embedField] = doc[embedField];
        });
      };

      var assignSubs = function(normalDoc, doc, fieldSpec) {
        var parseValue = function(value) {
          if ( typeof value === 'object' ) {
            return value;
          } else {
            return '' + value;
          }
        };

        if (fieldSpec.subs === '*') {
          angular.forEach(doc, function(value, fieldName) {
            if (typeof(value) !== 'function') {
              if (fieldName !== fieldSpec.id && fieldName !== fieldSpec.title &&
                  fieldName !== fieldSpec.thumb) {
                normalDoc.subs[fieldName] = parseValue(value);
              }
            }
          });
        }
        else {
          angular.forEach(fieldSpec.subs, function(subFieldName) {
            if ( /\./.test(subFieldName) ) {
              try {
                var value = pathIndex(doc, subFieldName);
                normalDoc.subs[subFieldName] = parseValue(value);
              } catch (e) {
                console.error(e);
                normalDoc.subs[subFieldName] = '';
              }
            } else if ( doc.hasOwnProperty(subFieldName) ) {
              normalDoc.subs[subFieldName] = parseValue(doc[subFieldName]);
            }
          });
          angular.forEach(fieldSpec.functions, function(functionField) {
            // for foo:$foo, look for foo
            var dispName = fieldDisplayName(functionField);

            if (doc.hasOwnProperty(dispName)) {
              normalDoc.subs[dispName] = parseValue(doc[dispName]);
            }
          });
          angular.forEach(fieldSpec.highlights, function(hlField) {
            if (fieldSpec.title !== hlField) {
              normalDoc.subs[hlField] = parseValue(doc[hlField]);
            }
          });
        }
      };

      var assignFields = function(normalDoc, doc, fieldSpec) {
        assignSingleField(normalDoc, doc, fieldSpec.id, 'id');
        assignSingleField(normalDoc, doc, fieldSpec.title, 'title');
        assignSingleField(normalDoc, doc, fieldSpec.thumb, 'thumb');
        normalDoc.titleField = fieldSpec.title;
        normalDoc.embeds = {};
        assignEmbeds(normalDoc, doc, fieldSpec);
        normalDoc.subs = {};
        assignSubs(normalDoc, doc, fieldSpec);
      };

      // A document within a query
      var NormalDoc = function(fieldSpec, doc) {
        this.doc = doc;
        assignFields(this, this.doc.origin(), fieldSpec);
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

        this._url = function() {
          return this.doc._url(fieldSpec.id, this.id);
        };

      };

      var getHighlightSnippet = function(aDoc, docId, subFieldName, subFieldValue, hlPre, hlPost) {
        var snip = aDoc.highlight(
          docId,
          subFieldName,
          hlPre,
          hlPost
        );

        if ( null === snip || undefined === snip || '' === snip ) {
          snip = escapeHtml(subFieldValue.slice(0, 200));
        }

        return snip;
      };

      // layer on highlighting features
      var snippitable = function(doc) {
        var aDoc = doc.doc;

        var lastSubSnips = {};
        var lastHlPre = null;
        var lastHlPost = null;

        doc.getHighlightedTitle = function(hlPre, hlPost) {
          return doc.title ? getHighlightSnippet(aDoc, doc.id, doc.titleField, doc.title, hlPre, hlPost) : null;
        };

        doc.subSnippets = function(hlPre, hlPost) {
          if (lastHlPre !== hlPre || lastHlPost !== hlPost) {
            var displayFields = angular.copy(doc.subs);

            angular.forEach(displayFields, function(subFieldValue, subFieldName) {
              if ( typeof subFieldValue === 'object' && !(subFieldValue instanceof Array) ) {
                lastSubSnips[subFieldName] = subFieldValue;
              } else {
                var snip = getHighlightSnippet(aDoc, doc.id, subFieldName, subFieldValue, hlPre, hlPost);

                lastSubSnips[subFieldName] = snip;
              }
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
          if (doc.origin().hasOwnProperty('id')) {
            return doc.explain(doc.origin().id);
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

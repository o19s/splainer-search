'use strict';

// Deals with normalizing documents from the search engine
// into a canonical representation, ie
// each doc has an id, a title, possibly a thumbnail field
// and possibly a list of sub fields
export function normalDocsSvcConstructor(explainSvc, utilsSvc) {
  var entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  };

  var escapeHtml = function (string) {
    return String(string).replace(/[&<>"'/]/g, function (s) {
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
  var multiIndex = function (obj, keys) {
    if (keys.length === 0) {
      return obj;
    } else if (Array.isArray(obj)) {
      return obj.map(function (child) {
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
  var pathIndex = function (obj, keys) {
    if (Object.hasOwn(obj, keys)) {
      return obj[keys];
    } else {
      return multiIndex(obj, keys.split('.'));
    }
  };

  var assignSingleField = function (normalDoc, doc, field, toProperty) {
    if (/\./.test(field)) {
      try {
        var value = pathIndex(doc, field);
        normalDoc[toProperty] = value !== null && value !== undefined ? '' + value : '';
      } catch (_e) {
        normalDoc[toProperty] = '';
      }
    } else if (Object.hasOwn(doc, field)) {
      var fieldVal = doc[field];
      normalDoc[toProperty] = fieldVal !== null && fieldVal !== undefined ? '' + fieldVal : '';
    }
  };

  var fieldDisplayName = function (funcFieldQuery) {
    // to Solr this is sent as foo:$foo, we just want to display "foo"
    return funcFieldQuery.split(':')[0];
  };

  var assignEmbeds = function (normalDoc, doc, fieldSpec) {
    utilsSvc.safeForEach(fieldSpec.embeds, function (embedField) {
      normalDoc.embeds[embedField] = doc[embedField];
    });
  };

  var assignTranslations = function (normalDoc, doc, fieldSpec) {
    utilsSvc.safeForEach(fieldSpec.translations, function (translationField) {
      normalDoc.translations[translationField] = doc[translationField];
    });
  };

  var assignUnabridgeds = function (normalDoc, doc, fieldSpec) {
    utilsSvc.safeForEach(fieldSpec.unabridgeds, function (unabridgedField) {
      normalDoc.unabridgeds[unabridgedField] = doc[unabridgedField];
    });
  };

  var assignSubs = function (normalDoc, doc, fieldSpec) {
    var parseValue = function (value) {
      if (value === null || value === undefined) {
        return '';
      } else if (typeof value === 'object') {
        return value;
      } else {
        return '' + value;
      }
    };

    if (fieldSpec.subs === '*') {
      utilsSvc.safeForEach(doc, function (value, fieldName) {
        if (typeof value !== 'function') {
          if (
            fieldName !== fieldSpec.id &&
            fieldName !== fieldSpec.title &&
            fieldName !== fieldSpec.thumb &&
            fieldName !== fieldSpec.image
          ) {
            normalDoc.subs[fieldName] = parseValue(value);
          }
        }
      });
    } else {
      utilsSvc.safeForEach(fieldSpec.subs, function (subFieldName) {
        if (/\./.test(subFieldName)) {
          try {
            var value = pathIndex(doc, subFieldName);
            normalDoc.subs[subFieldName] = parseValue(value);
          } catch (e) {
            console.error(e);
            normalDoc.subs[subFieldName] = '';
          }
        } else if (Object.hasOwn(doc, subFieldName)) {
          normalDoc.subs[subFieldName] = parseValue(doc[subFieldName]);
        }
      });
      utilsSvc.safeForEach(fieldSpec.functions, function (functionField) {
        // for foo:$foo, look for foo
        var dispName = fieldDisplayName(functionField);

        if (Object.hasOwn(doc, dispName)) {
          normalDoc.subs[dispName] = parseValue(doc[dispName]);
        }
      });
      utilsSvc.safeForEach(fieldSpec.highlights, function (hlField) {
        if (fieldSpec.title !== hlField) {
          normalDoc.subs[hlField] = parseValue(doc[hlField]);
        }
      });
    }
  };

  var assignFields = function (normalDoc, doc, fieldSpec) {
    assignSingleField(normalDoc, doc, fieldSpec.id, 'id');
    assignSingleField(normalDoc, doc, fieldSpec.title, 'title');
    assignSingleField(normalDoc, doc, fieldSpec.thumb, 'thumb');
    assignSingleField(normalDoc, doc, fieldSpec.image, 'image');
    if (fieldSpec.image_options) {
      normalDoc.image_options = fieldSpec.image_options;
    }
    if (fieldSpec.thumb_options) {
      normalDoc.thumb_options = fieldSpec.thumb_options;
    }
    normalDoc.titleField = fieldSpec.title;
    normalDoc.embeds = {};
    assignEmbeds(normalDoc, doc, fieldSpec);
    normalDoc.translations = {};
    assignTranslations(normalDoc, doc, fieldSpec);
    normalDoc.unabridgeds = {};
    assignUnabridgeds(normalDoc, doc, fieldSpec);
    normalDoc.subs = {};
    assignSubs(normalDoc, doc, fieldSpec);
  };

  // A document within a query
  var NormalDoc = function (fieldSpec, doc) {
    this.doc = doc;
    assignFields(this, this.doc.origin(), fieldSpec);
    var hasThumb = false;
    if (Object.hasOwn(this, 'thumb')) {
      hasThumb = true;
    }
    var hasImage = false;
    if (Object.hasOwn(this, 'image')) {
      hasImage = true;
    }
    this.subsList = [];
    var thisNormalDoc = this;
    utilsSvc.safeForEach(this.subs, function (subValue, subField) {
      var expanded = { field: subField, value: subValue };
      thisNormalDoc.subsList.push(expanded);
    });

    this.hasThumb = function () {
      return hasThumb;
    };

    this.hasImage = function () {
      return hasImage;
    };

    this._url = function () {
      return this.doc._url(fieldSpec.id, this.id);
    };
  };

  var getHighlightSnippet = function (aDoc, docId, subFieldName, subFieldValue, hlPre, hlPost) {
    var snip = aDoc.highlight(docId, subFieldName, hlPre, hlPost);

    if (null === snip || undefined === snip || '' === snip) {
      snip = escapeHtml(subFieldValue.slice(0, 200));
    }

    return snip;
  };

  // layer on highlighting features
  var snippitable = function (doc) {
    var aDoc = doc.doc;

    var lastSubSnips = {};
    var lastHlPre = null;
    var lastHlPost = null;

    doc.getHighlightedTitle = function (hlPre, hlPost) {
      return doc.title
        ? getHighlightSnippet(aDoc, doc.id, doc.titleField, doc.title, hlPre, hlPost)
        : null;
    };

    doc.subSnippets = function (hlPre, hlPost) {
      if (lastHlPre !== hlPre || lastHlPost !== hlPost) {
        var displayFields = utilsSvc.deepClone(doc.subs);

        utilsSvc.safeForEach(displayFields, function (subFieldValue, subFieldName) {
          if (typeof subFieldValue === 'object' && !(subFieldValue instanceof Array)) {
            lastSubSnips[subFieldName] = subFieldValue;
          } else {
            var snip = getHighlightSnippet(
              aDoc,
              doc.id,
              subFieldName,
              subFieldValue,
              hlPre,
              hlPost,
            );

            lastSubSnips[subFieldName] = snip;
          }
        });
      }
      return lastSubSnips;
    };
    return doc;
  };

  // layer on explain features
  var explainable = function (doc, explainJson) {
    var simplerExplain = null; // explainSvc.createExplain(explainJson);
    var hotMatches = null; //simplerExplain.vectorize();
    var matchDetails = null;

    var initExplain = function () {
      if (!simplerExplain) {
        simplerExplain = explainSvc.createExplain(explainJson);
        hotMatches = simplerExplain.vectorize();
        matchDetails = simplerExplain.matchDetails();
      }
    };

    doc.explain = function () {
      initExplain();
      return simplerExplain;
    };

    doc.hotMatches = function () {
      initExplain();
      return hotMatches;
    };

    doc.matchDetails = function () {
      initExplain();
      return matchDetails;
    };

    var hotOutOf = [];
    var lastMaxScore = -1;
    doc.hotMatchesOutOf = function (maxScore) {
      initExplain();
      if (maxScore !== lastMaxScore) {
        hotOutOf.length = 0;
      }
      lastMaxScore = maxScore;
      if (hotOutOf.length === 0) {
        utilsSvc.safeForEach(hotMatches.vecObj, function (value, key) {
          var percentage = ((0.0 + value) / maxScore) * 100.0;
          hotOutOf.push({ description: key, metadata: matchDetails[key], percentage: percentage });
        });
        hotOutOf.sort(function (a, b) {
          return b.percentage - a.percentage;
        });
      }
      return hotOutOf;
    };

    doc.score = function () {
      initExplain();
      return simplerExplain.contribution();
    };
    return doc;
  };

  var getDocExplain = function (doc, nDoc) {
    var explJson = doc.explain(nDoc.id);
    if (explJson === null) {
      if (Object.hasOwn(doc.origin(), 'id')) {
        return doc.explain(doc.origin().id);
      }
    }
    return explJson;
  };

  this.createNormalDoc = function (fieldSpec, doc, altExplainJson) {
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
  this.explainDoc = function (doc, explainJson) {
    return explainable(doc, explainJson);
  };

  this.snippetDoc = function (doc) {
    return snippitable(doc);
  };

  // A stub, used to display a result that we expected
  // to find, but isn't there
  this.createPlaceholderDoc = function (docId, stubTitle, explainJson) {
    var placeHolder = { id: docId, title: stubTitle };
    if (explainJson) {
      return snippitable(explainable(placeHolder, explainJson));
    } else {
      placeHolder.subSnippets = function () {
        return '';
      };
      return placeHolder;
    }
  };
}

// Angular DI registration (removed in Phase 4)
if (typeof angular !== 'undefined') {
  angular
    .module('o19s.splainer-search')
    .service('normalDocsSvc', ['explainSvc', 'utilsSvc', normalDocsSvcConstructor]);
}

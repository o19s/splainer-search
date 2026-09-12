'use strict';

export function AlgoliaDocFactory(DocFactory, utilsSvc) {
  const Doc = function (doc, options) {
    DocFactory.call(this, doc, options);

    const self = this;

    utilsSvc.safeForEach(self.fieldsProperty(), function (fieldValue, fieldName) {
      if (
        fieldValue !== null &&
        fieldValue !== undefined &&
        fieldValue.constructor === Array &&
        fieldValue.length === 1
      ) {
        self[fieldName] = fieldValue[0];
      } else {
        self[fieldName] = fieldValue;
      }
    });
  };

  Doc.prototype = Object.create(DocFactory.prototype);
  Doc.prototype.constructor = Doc; // Reset the constructor
  Doc.prototype._url = _url;
  Doc.prototype.origin = origin;
  Doc.prototype.fieldsProperty = fieldsProperty;
  Doc.prototype.explain = explain;
  Doc.prototype.snippet = snippet;
  Doc.prototype.highlight = highlight;

  function _url() {
    // no _url functionality implemented
    return null;
  }

  function origin() {
    var self = this;

    var src = {};
    utilsSvc.safeForEach(self, function (value, field) {
      if (typeof value !== 'function') {
        src[field] = value;
      }
    });
    delete src.doc;
    // Algolia's response metadata, copied onto self by DocFactory's copyOnto - not part of
    // the document itself, so excluded the same way esDocFactory.js excludes its own
    // engine-specific response metadata (fields/highlight/_explanation) from origin().
    delete src._highlightResult;
    delete src._snippetResult;
    delete src._rankingInfo;
    return src;
  }

  function fieldsProperty() {
    const self = this;
    return self;
  }

  // Algolia has no per-term score breakdown to explain (see README's Algolia section) - its
  // ranking is an ordered tie-break sequence of criteria, not a summed/weighted score. Rather
  // than a separate accessor, its raw `_rankingInfo` (only present when the query set
  // `getRankingInfo: true` - nbTypos, proximityDistance, userScore, etc.) is merged onto
  // utilsSvc.emptyExplain() - the same safe defaults every other unsupported engine already
  // returns - applied last so `_rankingInfo` can never override them, but everything else
  // survives onto `explain().asJson`, so `explain().rawStr()` shows it all as one raw JSON blob -
  // the existing debug/detail view "just works" with no other code needing to know Algolia is special.
  function explain() {
    var self = this;
    var rankingInfo = self.doc._rankingInfo;

    if (!rankingInfo) {
      return {};
    }

    return Object.assign({}, rankingInfo, utilsSvc.emptyExplain());
  }

  // Algolia's _highlightResult/_snippetResult give one {value, matchLevel, ...} object per
  // scalar field, or an array of those objects per array field (e.g. one per cast member) -
  // normalize both shapes to a plain array of value strings, matching what
  // esDocFactory.js's snippet()/highlight() already expect to work with.
  function extractHighlightValues(highlightField) {
    if (!highlightField) {
      return null;
    }
    if (Array.isArray(highlightField)) {
      return highlightField.map(function (entry) {
        return entry.value;
      });
    }
    return [highlightField.value];
  }

  // Algolia's pre-truncated highlighted fragment for a field, in its own <em>/</em> tags -
  // unlike ES (which highlight() re-derives from the same source snippet() uses), Algolia
  // returns this as a separate response key from the full-field highlight below.
  function snippet(docId, fieldName) {
    var self = this;
    var docSnippets = self.doc._snippetResult;

    return extractHighlightValues(docSnippets && docSnippets[fieldName]);
  }

  function highlight(docId, fieldName, preText, postText) {
    var self = this;
    var docHighlights = self.doc._highlightResult;
    var fieldValue = extractHighlightValues(docHighlights && docHighlights[fieldName]);

    return utilsSvc.convertHighlightTags(fieldValue, preText, postText);
  }

  return Doc;
}

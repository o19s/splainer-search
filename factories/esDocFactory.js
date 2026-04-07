'use strict';

export function EsDocFactory(esUrlSvc, DocFactory, utilsSvc) {
  var Doc = function (doc, options) {
    DocFactory.call(this, doc, options);

    var self = this;

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

    // Delete the highlight snippet because the normalized doc expect
    // `highlight` to be a function, not an object.
    // The highlight snippet is still available from `self.doc.highlight`.
    delete self.highlight;
  };

  Doc.prototype = Object.create(DocFactory.prototype);
  Doc.prototype.constructor = Doc; // Reset the constructor

  Doc.prototype._url = _url;
  Doc.prototype.fieldsProperty = fieldsProperty;
  Doc.prototype.explain = explain;
  Doc.prototype.snippet = snippet;
  Doc.prototype.origin = origin;
  Doc.prototype.highlight = highlight;

  function _url() {
    var self = this;
    var doc = self.doc;
    var esurl = self.options().url;

    var uri = esUrlSvc.parseUrl(esurl);
    return esUrlSvc.buildDocUrl(uri, doc);
  }

  function fieldsProperty() {
    var self = this;
    // Bracket notation for ES document keys (_source, fields).
    return Object.assign({}, self['_source'], self['fields']);
  }

  function explain() {
    var self = this;
    return self.options().explDict;
  }

  function snippet(docId, fieldName) {
    var self = this;

    if (Object.hasOwn(self.doc, 'highlight')) {
      var docHls = self.doc.highlight;
      if (Object.hasOwn(docHls, fieldName)) {
        return docHls[fieldName];
      }
    }
    return null;
  }

  function origin() {
    var self = this;

    // Usually you would return _source, but since we are specifying the
    // fields to display, ES only returns those specific fields.
    // And we are assigning the fields to the doc itself in this case.
    var src = {};
    utilsSvc.safeForEach(self, function (value, field) {
      if (typeof value !== 'function') {
        src[field] = utilsSvc.deepClone(value);
      }
    });
    delete src.doc;
    delete src.fields;
    delete src._explanation;
    delete src.highlight;
    return src;
  }

  function highlight(docId, fieldName, preText, postText) {
    var self = this;
    var fieldValue = self.snippet(docId, fieldName);

    if (fieldValue) {
      var newValue = [];
      utilsSvc.safeForEach(fieldValue, function (value) {
        // Doing the naive thing and assuming that the highlight tags
        // were not overridden in the query DSL.
        var preRegex = new RegExp('<em>', 'g');
        var hlPre = value.replace(preRegex, preText);
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


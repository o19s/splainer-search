'use strict';

export function SearchApiDocFactory(DocFactory, utilsSvc) {
  const Doc = function (doc, options) {
    DocFactory.call(this, doc, options);

    const self = this;

    utilsSvc.safeForEach(self.fieldsProperty(), function (fieldValue, fieldName) {
      if (Array.isArray(fieldValue) && fieldValue.length === 1) {
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
    return src;
  }

  function fieldsProperty() {
    const self = this;
    return self;
  }

  function explain() {
    // no explain functionality implemented
    return {};
  }

  function snippet() {
    // no snippet functionality implemented
    return null;
  }

  function highlight() {
    // no highlighting functionality implemented
    return null;
  }

  return Doc;
}


'use strict';

export function fieldSpecSvcConstructor(utilsSvc) {
  var addFieldOfType = function (fieldSpec, fieldType, fieldName, fieldOptions) {
    if (['f', 'func', 'function'].includes(fieldType)) {
      if (!Object.hasOwn(fieldSpec, 'functions')) {
        fieldSpec.functions = [];
      }
      // a function query function:foo is really foo:$foo
      if (fieldName.startsWith('$')) {
        fieldName = fieldName.slice(1);
      }
      fieldName = fieldName + ':$' + fieldName;
      fieldSpec.functions.push(fieldName);
    }
    if (['highlight', 'hl'].includes(fieldType)) {
      if (!Object.hasOwn(fieldSpec, 'highlights')) {
        fieldSpec.highlights = [];
      }
      fieldSpec.highlights.push(fieldName);
    }
    if (fieldType === 'media') {
      if (!Object.hasOwn(fieldSpec, 'embeds')) {
        fieldSpec.embeds = [];
      }
      fieldSpec.embeds.push(fieldName);
    }
    if (fieldType === 'translate') {
      if (!Object.hasOwn(fieldSpec, 'translations')) {
        fieldSpec.translations = [];
      }
      fieldSpec.translations.push(fieldName);
    }
    if (fieldType === 'unabridged') {
      if (!Object.hasOwn(fieldSpec, 'unabridgeds')) {
        fieldSpec.unabridgeds = [];
      }
      fieldSpec.unabridgeds.push(fieldName);
    }
    if (fieldType === 'sub') {
      if (!Object.hasOwn(fieldSpec, 'subs')) {
        fieldSpec.subs = [];
      }
      if (fieldSpec.subs !== '*') {
        fieldSpec.subs.push(fieldName);
      }
      if (fieldName === '*') {
        fieldSpec.subs = '*';
      }
    } else if (!Object.hasOwn(fieldSpec, fieldType)) {
      fieldSpec[fieldType] = fieldName;
      fieldSpec[fieldType + '_options'] = fieldOptions;
    }
    fieldSpec.fields.push(fieldName);
  };

  // Populate field spec from a field spec string
  var populateFieldSpec = function (fieldSpec, fieldSpecStr) {
    var fieldSpecs = [];
    var fieldSpecStrToConsume = fieldSpecStr.split('+').join(' ');
    for (let chunkEnd = -1; fieldSpecStrToConsume.length > 0; ) {
      if (fieldSpecStrToConsume[0] === '{') {
        chunkEnd = fieldSpecStrToConsume.indexOf('}') + 1;
      } else {
        chunkEnd = fieldSpecStrToConsume.search(/[\s,]+/);
        if (chunkEnd === -1) {
          chunkEnd = fieldSpecStrToConsume.length;
        }
      }
      fieldSpecs.push(fieldSpecStrToConsume.substr(0, chunkEnd));
      fieldSpecStrToConsume = fieldSpecStrToConsume.substr(
        chunkEnd + 1,
        fieldSpecStrToConsume.length,
      );
    }

    utilsSvc.safeForEach(fieldSpecs, function (aField) {
      var fieldTypes = null;
      var fieldName = null;
      var fieldOptions = null;
      if (aField[0] === '{') {
        var fieldDefinition = JSON.parse(aField);

        fieldName = fieldDefinition.name;
        fieldTypes = [fieldDefinition.type];
        delete fieldDefinition.name;
        delete fieldDefinition.type;
        fieldOptions = fieldDefinition;
      } else {
        var specElements = aField.split(':');
        if (specElements.length === 1) {
          fieldName = specElements[0];
          if (Object.hasOwn(fieldSpec, 'title')) {
            fieldTypes = ['sub'];
          } else {
            fieldTypes = ['title'];
          }
        } else if (specElements.length > 1) {
          fieldName = specElements.pop();
          fieldTypes = specElements;
        }
      }

      if (fieldTypes && fieldName) {
        utilsSvc.safeForEach(fieldTypes, function (fieldType) {
          addFieldOfType(fieldSpec, fieldType, fieldName, fieldOptions);
        });
      }
    });
  };

  var FieldSpec = function (fieldSpecStr) {
    this.fields = [];
    this.fieldSpecStr = fieldSpecStr;
    populateFieldSpec(this, fieldSpecStr);
    if (!Object.hasOwn(this, 'id')) {
      this.id = 'id';
      this.fields.push('id');
    }

    if (!Object.hasOwn(this, 'title')) {
      this.title = this.id;
    }

    this.fieldList = function () {
      if (Object.hasOwn(this, 'subs') && this.subs === '*') {
        return '*';
      }
      var rVal = [this.id];
      this.forEachField(function (fieldName) {
        rVal.push(fieldName);
      });
      return rVal;
    };

    this.highlightFieldList = function () {
      return this.highlights;
    };

    // Execute innerBody for each (non id) field
    this.forEachField = function (innerBody) {
      if (Object.hasOwn(this, 'title')) {
        innerBody(this.title);
      }
      if (Object.hasOwn(this, 'thumb')) {
        innerBody(this.thumb);
      }
      if (Object.hasOwn(this, 'image')) {
        innerBody(this.image);
      }
      utilsSvc.safeForEach(this.embeds, function (embed) {
        innerBody(embed);
      });
      utilsSvc.safeForEach(this.translations, function (translate) {
        innerBody(translate);
      });
      utilsSvc.safeForEach(this.unabridgeds, function (unabridged) {
        innerBody(unabridged);
      });
      utilsSvc.safeForEach(this.highlights, function (hl) {
        innerBody(hl);
      });
      utilsSvc.safeForEach(this.subs, function (sub) {
        innerBody(sub);
      });
      utilsSvc.safeForEach(this.functions, function (func) {
        innerBody(func);
      });
    };
  };

  var transformFieldSpec = function (fieldSpecStr) {
    var defFieldSpec = 'id:id title:id *';
    if (fieldSpecStr == null || fieldSpecStr.trim().length === 0) {
      return defFieldSpec;
    }

    var fieldSpecs = fieldSpecStr.split(/[\s,]+/);
    if (fieldSpecs[0] === '*') {
      return defFieldSpec;
    }
    return fieldSpecStr;
  };

  this.createFieldSpec = function (fieldSpecStr) {
    fieldSpecStr = transformFieldSpec(fieldSpecStr);
    return new FieldSpec(fieldSpecStr);
  };
}


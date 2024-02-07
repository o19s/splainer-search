'use strict';

angular.module('o19s.splainer-search')
  .service('fieldSpecSvc', [
    function fieldSpecSvc() {
      var addFieldOfType = function(fieldSpec, fieldType, fieldName, fieldOptions) {
        if (['f', 'func', 'function'].includes(fieldType)) {
          if (!fieldSpec.hasOwnProperty('functions')) {
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
          if (!fieldSpec.hasOwnProperty('highlights')) {
            fieldSpec.highlights = [];
          }
          fieldSpec.highlights.push(fieldName);
        }
        if (fieldType === 'media') {
            if (!fieldSpec.hasOwnProperty('embeds')) {
              fieldSpec.embeds = [];
            }

            fieldSpec.embeds.push(fieldName);
        }
        if (fieldType === 'translate') {
          if (!fieldSpec.hasOwnProperty('translations')) {
            fieldSpec.translations = [];
          }

          fieldSpec.translations.push(fieldName);
        }
        if (fieldType === 'unabridged') {
          if (!fieldSpec.hasOwnProperty('unabridged')) {
            fieldSpec.unabridgeds = [];
          }

          fieldSpec.unabridgeds.push(fieldName);
        }        
        if (fieldType === 'sub') {
          if (!fieldSpec.hasOwnProperty('subs')) {
            fieldSpec.subs = [];
          }
          if (fieldSpec.subs !== '*') {
            fieldSpec.subs.push(fieldName);
          }
          if (fieldName === '*') {
            fieldSpec.subs = '*';
          }
        }
        else if (!fieldSpec.hasOwnProperty(fieldType)) {
          fieldSpec[fieldType] = fieldName;
          fieldSpec[fieldType + '_options'] = fieldOptions;

        }
        fieldSpec.fields.push(fieldName);
      };

      // Populate field spec from a field spec string
      var populateFieldSpec = function(fieldSpec, fieldSpecStr) {

        var fieldSpecs = [];
        var fieldSpecStrToConsume = fieldSpecStr.split('+').join(' ');
        for (let chunkEnd = -1; fieldSpecStrToConsume.length > 0; ){
          if (fieldSpecStrToConsume[0] === '{'){
            chunkEnd = fieldSpecStrToConsume.indexOf('}') + 1;
          }
          else {
            chunkEnd = fieldSpecStrToConsume.search(/[\s,]+/);
            if (chunkEnd === -1){
              chunkEnd = fieldSpecStrToConsume.length;
            }
          }
          fieldSpecs.push(fieldSpecStrToConsume.substr(0,chunkEnd));
          fieldSpecStrToConsume = fieldSpecStrToConsume.substr(chunkEnd+1, fieldSpecStrToConsume.length);

        }

        angular.forEach(fieldSpecs, function(aField) {

          var fieldTypes = null;
          var fieldName = null;
          var fieldOptions = null;
          if (aField[0] === '{'){
            var fieldDefinition = JSON.parse(aField);

            fieldName = fieldDefinition.name;
            fieldTypes = [fieldDefinition.type];
            delete fieldDefinition.name;
            delete fieldDefinition.type;
            fieldOptions = fieldDefinition;

          }
          else {
            var specElements = aField.split(':');
            if (specElements.length === 1) {
              fieldName = specElements[0];
              if (fieldSpec.hasOwnProperty('title')) {
                fieldTypes = ['sub'];
              }
              else {
                fieldTypes = ['title'];
              }
            } else if (specElements.length > 1) {
              fieldName = specElements.pop();
              fieldTypes = specElements;
            }
          }

          if (fieldTypes && fieldName) {
            angular.forEach(fieldTypes, function(fieldType) {
              addFieldOfType(fieldSpec, fieldType, fieldName, fieldOptions);
            });
          }
        });
      };


      var FieldSpec = function(fieldSpecStr) {
        this.fields = [];
        this.fieldSpecStr = fieldSpecStr;
        populateFieldSpec(this, fieldSpecStr);
        if (!this.hasOwnProperty('id')) {
          this.id = 'id';
          this.fields.push('id');
        }

        if (!this.hasOwnProperty('title')) {
          this.title = this.id;
        }

        this.fieldList = function() {
          if (this.hasOwnProperty('subs') && this.subs === '*') {
            return '*';
          }
          var rVal = [this.id];
          this.forEachField(function(fieldName) {
            rVal.push(fieldName);
          });
          return rVal;
        };

        this.highlightFieldList = function() {
          return this.highlights;
        };

        // Execute innerBody for each (non id) field
        this.forEachField = function(innerBody) {
          if (this.hasOwnProperty('title')) {
            innerBody(this.title);
          }
          if (this.hasOwnProperty('thumb')) {
            innerBody(this.thumb);
          }
          if (this.hasOwnProperty('image')) {
            innerBody(this.image);
          }
          angular.forEach(this.embeds, function(embed) {
            innerBody(embed);
          });
          angular.forEach(this.translations, function(translate) {
            innerBody(translate);
          });
          angular.forEach(this.unabridgeds, function(unabridged) {
            innerBody(unabridged);
          });          
          angular.forEach(this.highlights, function(hl) {
            innerBody(hl);
          });
          angular.forEach(this.subs, function(sub) {
            innerBody(sub);
          });
          angular.forEach(this.functions, function(func) {
            innerBody(func);
          });
        };
      };

      var transformFieldSpec = function(fieldSpecStr) {
        var defFieldSpec = 'id:id title:id *';
        if (fieldSpecStr === null || fieldSpecStr.trim().length === 0) {
          return defFieldSpec;
        }

        var fieldSpecs = fieldSpecStr.split(/[\s,]+/);
        if (fieldSpecs[0] === '*') {
          return defFieldSpec;
        }
        return fieldSpecStr;
      };

      this.createFieldSpec = function(fieldSpecStr) {
        fieldSpecStr = transformFieldSpec(fieldSpecStr);
        return new FieldSpec(fieldSpecStr);
      };

    }
  ]);

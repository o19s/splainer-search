'use strict';

angular.module('o19s.splainer-search')
  .service('fieldSpecSvc', function fieldSpecSvc() {
    // AngularJS will instantiate a singleton by calling 'new' on this function
    
    var addFieldOfType = function(fieldSpec, fieldType, fieldName) {
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
      }
      fieldSpec.fields.push(fieldName);
    };

    // Populate field spec from a field spec string
    var populateFieldSpec = function(fieldSpec, fieldSpecStr) {
      var fieldSpecs = fieldSpecStr.split('+').join(' ').split(/[\s,]+/);
      angular.forEach(fieldSpecs, function(aField) {
        var typeAndField = aField.split(':');
        var fieldType = null;
        var fieldName = null;
        if (typeAndField.length === 2) {
          fieldType = typeAndField[0];
          fieldName = typeAndField[1];
        }
        else if (typeAndField.length === 1) {
          fieldName = typeAndField[0];
          if (fieldSpec.hasOwnProperty('title')) {
            fieldType = 'sub';
          }
          else {
            fieldType = 'title';
          }
        }
        if (fieldType && fieldName) {
          addFieldOfType(fieldSpec, fieldType, fieldName);
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

      // Execute innerBody for each (non id) field
      this.forEachField = function(innerBody) {
        if (this.hasOwnProperty('title')) {
          innerBody(this.title);
        }
        if (this.hasOwnProperty('thumb')) {
          innerBody(this.thumb);
        }
        angular.forEach(this.subs, function(sub) {
          innerBody(sub);
        });
      };
    };

    var transformFieldSpec = function(fieldSpecStr) {
      var defFieldSpec = 'id:id title:id *';
      var fieldSpecs = fieldSpecStr.split(/[\s,]+/);
      if (fieldSpecStr.trim().length === 0) {
        return defFieldSpec;
      }
      if (fieldSpecs[0] === '*') {
        return defFieldSpec;
      }
      return fieldSpecStr;
    };

    this.createFieldSpec = function(fieldSpecStr) {
      fieldSpecStr = transformFieldSpec(fieldSpecStr);
      return new FieldSpec(fieldSpecStr);
    };

  });

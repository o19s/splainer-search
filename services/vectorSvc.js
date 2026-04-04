'use strict';

/*
 * Basic vector operations used by explain svc
 *
 * */
export function vectorSvcConstructor(utilsSvc) {
  var SparseVector = function () {
    this.vecObj = {};

    var asStr = '';
    var setDirty = function () {
      asStr = '';
    };

    this.set = function (key, value) {
      this.vecObj[key] = value;
      setDirty();
    };

    this.get = function (key) {
      if (Object.hasOwn(this.vecObj, key)) {
        return this.vecObj[key];
      }
      return undefined;
    };

    this.add = function (key, value) {
      if (Object.hasOwn(this.vecObj, key)) {
        this.vecObj[key] += value;
      } else {
        this.vecObj[key] = value;
      }
      setDirty();
    };

    this.toStr = function () {
      // memoize the toStr conversion
      if (asStr === '') {
        // sort
        var sortedL = [];
        utilsSvc.safeForEach(this.vecObj, function (value, key) {
          sortedL.push([key, value]);
        });
        sortedL.sort(function (lhs, rhs) {
          return rhs[1] - lhs[1];
        });
        utilsSvc.safeForEach(sortedL, function (keyVal) {
          asStr += keyVal[1] + ' ' + keyVal[0] + '\n';
        });
      }
      return asStr;
    };
  };

  this.create = function () {
    return new SparseVector();
  };

  this.add = function (lhs, rhs) {
    var rVal = this.create();
    utilsSvc.safeForEach(lhs.vecObj, function (value, key) {
      rVal.set(key, value);
    });
    utilsSvc.safeForEach(rhs.vecObj, function (value, key) {
      rVal.set(key, value);
    });
    return rVal;
  };

  this.sumOf = function (lhs, rhs) {
    var rVal = this.create();
    utilsSvc.safeForEach(lhs.vecObj, function (value, key) {
      rVal.add(key, value);
    });
    utilsSvc.safeForEach(rhs.vecObj, function (value, key) {
      rVal.add(key, value);
    });
    return rVal;
  };

  this.scale = function (lhs, scalar) {
    var rVal = this.create();
    utilsSvc.safeForEach(lhs.vecObj, function (value, key) {
      rVal.set(key, value * scalar);
    });
    return rVal;
  };
}

// Angular DI registration (removed in Phase 4)
if (typeof angular !== 'undefined') {
  angular.module('o19s.splainer-search').service('vectorSvc', ['utilsSvc', vectorSvcConstructor]);
}

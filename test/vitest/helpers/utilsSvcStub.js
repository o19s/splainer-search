/**
 * Native-JS implementation of utilsSvc for Vitest.
 * Mirrors the contract of services/utilsSvc.js without Angular dependencies.
 * This is effectively what utilsSvc will become after Phase 3.
 */

export function safeForEach(collection, callback) {
  if (collection == null) return;
  if (Array.isArray(collection)) {
    collection.forEach(callback);
  } else if (typeof collection === 'string') {
    for (var i = 0; i < collection.length; i++) {
      callback(collection[i], i, collection);
    }
  } else if (typeof collection === 'object') {
    Object.keys(collection).forEach(function (key) {
      callback(collection[key], key, collection);
    });
  }
}

export function deepClone(obj) {
  return structuredClone(obj);
}

export function copyOnto(destination, source) {
  Object.keys(destination).forEach(function (key) {
    delete destination[key];
  });
  var cloned = deepClone(source);
  Object.assign(destination, cloned);
  return destination;
}

export function deepMerge(target /*, ...sources */) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];
    if (source == null) continue;
    Object.keys(source).forEach(function (key) {
      var srcVal = source[key];
      var tgtVal = target[key];
      if (
        srcVal !== null &&
        typeof srcVal === 'object' &&
        !Array.isArray(srcVal) &&
        tgtVal !== null &&
        typeof tgtVal === 'object' &&
        !Array.isArray(tgtVal)
      ) {
        deepMerge(tgtVal, srcVal);
      } else {
        target[key] = deepClone(srcVal);
      }
    });
  }
  return target;
}

export default {
  safeForEach,
  deepClone,
  copyOnto,
  deepMerge,
};

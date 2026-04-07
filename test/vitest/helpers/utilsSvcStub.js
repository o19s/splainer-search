/**
 * Native-JS implementation of utilsSvc for Vitest.
 * Mirrors the contract of services/utilsSvc.js — no Angular dependency.
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
  if (obj == null || typeof obj !== 'object') return obj;
  try {
    return structuredClone(obj);
  } catch (_e) {
    return JSON.parse(JSON.stringify(obj));
  }
}

export function copyOnto(destination, source) {
  Object.keys(destination).forEach(function (key) {
    delete destination[key];
  });
  Object.assign(destination, deepClone(source));
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
        srcVal != null &&
        typeof srcVal === 'object' &&
        tgtVal != null &&
        typeof tgtVal === 'object'
      ) {
        deepMerge(tgtVal, srcVal);
      } else {
        target[key] = deepClone(srcVal);
      }
    });
  }
  return target;
}

export function mergeSearcherConfig(searcher, defaultConfig) {
  if (searcher.config === undefined) {
    searcher.config = defaultConfig;
  } else {
    searcher.config = deepMerge({}, defaultConfig, searcher.config);
  }
}

var HAS_HTTP_OR_HTTPS_PROTOCOL = /^https{0,1}:/;

export function ensureUrlHasProtocol(url) {
  if (!HAS_HTTP_OR_HTTPS_PROTOCOL.test(url)) {
    return 'http://' + url;
  }
  return url;
}

export default {
  safeForEach,
  deepClone,
  copyOnto,
  deepMerge,
  mergeSearcherConfig,
  ensureUrlHasProtocol,
};

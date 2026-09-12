'use strict';

/**
 * Utility helpers for iteration, deep-cloning, deep-merging plain data
 * (configs, Solr/ES/Vectara response shapes), normalizing scheme-less URLs,
 * and applying default searcher config in preprocessors.
 *
 * These were originally thin shims over Angular's `forEach`, `copy`, and `merge`.
 * They now use native JS — no Angular dependency required.
 *
 * @see MIGRATION_CHANGES.md (Angular removal / shim migration)
 */
export function utilsSvcFactory() {
  /**
   * Iterates over a collection: `null` / `undefined` are no-ops; arrays yield
   * `(value, index, array)`; objects own keys yield `(value, key, obj)`; strings yield
   * per-code-unit `(char, index, string)`.
   *
   * @param {Array|Object|string|null|undefined} collection
   * @param {function(*, (string|number), (Object|string|Array)=): void} callback
   */
  function safeForEach(collection, callback) {
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

  /**
   * Deep-clones plain data (configs, Solr/ES response shapes).
   *
   * Handles JSON-ish POJOs, arrays, and primitives used across this library.
   * Objects containing functions or other non-cloneable values fall back to a
   * JSON roundtrip, which silently drops functions and undefined values.
   *
   * @template T
   * @param {T} obj
   * @returns {T}
   */
  function deepClone(obj) {
    if (obj == null || typeof obj !== 'object') return obj;
    try {
      return structuredClone(obj);
    } catch (_e) {
      // structuredClone throws on functions, DOM nodes, etc.
      // Fall back to JSON roundtrip, which silently drops function-valued
      // properties and undefined values.  This differs from angular.copy, which
      // preserved function references.  No call site in this codebase depends
      // on cloned functions surviving — origin() pre-filters them, and all
      // other callers pass plain JSON data.
      return JSON.parse(JSON.stringify(obj));
    }
  }

  /**
   * Clears `destination`, then deep-copies all properties from `source` into it
   * (mutates `destination`).
   *
   * **Note:** existing own properties on `destination` are removed before copying.
   *
   * @param {Object} destination Object to receive properties (cleared first).
   * @param {Object} source Source object (plain data — same contract as {@link deepClone}).
   * @returns {Object} `destination`
   */
  function copyOnto(destination, source) {
    Object.keys(destination).forEach(function (key) {
      delete destination[key];
    });
    Object.assign(destination, deepClone(source));
    return destination;
  }

  /**
   * Deep-merges sources into `target` (mutates `target`).
   *
   * Matches `angular.merge` semantics: recursively merges nested objects and arrays
   * (arrays merge by index, not wholesale replacement).
   *
   * @param {Object} target Destination object.
   * @param {...Object} sources
   * @returns {Object} `target`
   */
  function deepMerge(target /*, ...sources */) {
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

  /**
   * Fills in `searcher.config` from defaults when it is missing; otherwise
   * deep-merges so caller-supplied fields win and unspecified fields come from
   * `defaultConfig` (same as `deepMerge({}, defaultConfig, searcher.config)`).
   *
   * When `searcher.config` is `undefined`, assigns the `defaultConfig` reference
   * (no clone), matching prior preprocessor behavior.
   *
   * @param {{ config?: Object }} searcher
   * @param {Object} defaultConfig
   */
  function mergeSearcherConfig(searcher, defaultConfig) {
    if (searcher.config === undefined) {
      searcher.config = defaultConfig;
    } else {
      searcher.config = deepMerge({}, defaultConfig, searcher.config);
    }
  }

  var HAS_HTTP_OR_HTTPS_PROTOCOL = /^https{0,1}:/;

  /**
   * Prefixes `http://` when the string has no `http:` or `https:` scheme.
   * Used before parsing scheme-less URLs (Solr/ES host-only input).
   *
   * @param {string} url
   * @returns {string}
   */
  function ensureUrlHasProtocol(url) {
    if (!HAS_HTTP_OR_HTTPS_PROTOCOL.test(url)) {
      return 'http://' + url;
    }
    return url;
  }

  /**
   * A safe, neutral "nothing to explain" shape - shared by explainSvc.js's own fallback (for
   * malformed/missing explain json) and any docFactory that wants that same safe shape while
   * still merging its own diagnostic fields on top (see algoliaDocFactory.js's explain()).
   * `description` must stay a plain, non-matching string - explainSvc.js's createExplain
   * dispatches on description prefixes/substrings, so a nonsense or absent description would
   * throw - and carries no user-facing copy on purpose: whether/how to tell the user "no
   * explanation available" is a host app's call, detected via `explain().children.length === 0`.
   * Returns a fresh object each call so callers can merge into it without sharing mutable state.
   *
   * @returns {{details: Array, description: string, value: number, match: boolean}}
   */
  function emptyExplain() {
    return { details: [], description: '', value: 0.0, match: true };
  }

  /**
   * Converts an engine's raw `<em>`/`</em>`-tagged highlight fragments to the caller-supplied
   * pre/post text. Naively assumes the tags were not overridden in the query (matches
   * esDocFactory.js's and algoliaDocFactory.js's own long-standing assumption).
   *
   * @param {string[]|null|undefined} fieldValues
   * @param {string} preText
   * @param {string} postText
   * @returns {string[]|null}
   */
  function convertHighlightTags(fieldValues, preText, postText) {
    if (!fieldValues) {
      return null;
    }
    var preRegex = new RegExp('<em>', 'g');
    var postRegex = new RegExp('</em>', 'g');
    return fieldValues.map(function (value) {
      return value.replace(preRegex, preText).replace(postRegex, postText);
    });
  }

  return {
    safeForEach: safeForEach,
    deepClone: deepClone,
    copyOnto: copyOnto,
    deepMerge: deepMerge,
    mergeSearcherConfig: mergeSearcherConfig,
    ensureUrlHasProtocol: ensureUrlHasProtocol,
    emptyExplain: emptyExplain,
    convertHighlightTags: convertHighlightTags,
  };
}

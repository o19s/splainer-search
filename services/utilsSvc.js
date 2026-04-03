'use strict';

/**
 * Migration shims for {@link https://docs.angularjs.org/api/ng/function/angular.forEach angular.forEach},
 * {@link https://docs.angularjs.org/api/ng/function/angular.copy angular.copy}, and
 * {@link https://docs.angularjs.org/api/ng/function/angular.merge angular.merge}.
 *
 * Call sites should depend on this service (or future plain exports) instead of calling those APIs
 * directly. Implementations delegate to Angular while the library still ships as an Angular module;
 * post-migration, internals swap to native helpers (e.g. `structuredClone`, custom `deepMerge`)
 * without a broad call-site churn.
 *
 * @see MIGRATION_PREP.md §5 Introduce Shim Layer
 */
angular.module('o19s.splainer-search').factory('utilsSvc', function utilsSvcFactory() {
  /**
   * Iterates like `angular.forEach`: `null` / `undefined` are no-ops; arrays yield
   * `(value, index, array)`; objects own keys yield `(value, key, obj)`; strings yield
   * per-code-unit `(char, index, string)`.
   *
   * @param {Array|Object|string|null|undefined} collection
   * @param {function(*, (string|number), (Object|string|Array)=): void} callback
   */
  function safeForEach(collection, callback) {
    angular.forEach(collection, callback);
  }

  /**
   * Deep-clones plain data (configs, Solr/ES response shapes). Today: `angular.copy`.
   *
   * **Guarantee:** JSON-ish POJOs, arrays, and primitives used across this library. Not equivalent
   * to cloning functions, symbols, custom prototypes, DOM nodes, or arbitrary object graphs with
   * cycles; those call sites need an explicit strategy after Angular removal.
   *
   * @template T
   * @param {T} obj
   * @returns {T}
   */
  function deepClone(obj) {
    return angular.copy(obj);
  }

  /**
   * Deep-merges sources into `target` (mutates `target`), matching `angular.merge`.
   *
   * @param {Object} target Destination object.
   * @param {...Object} sources
   * @returns {Object} `target`
   */
  function deepMerge(/* target, ...sources */) {
    return angular.merge.apply(angular, arguments);
  }

  return {
    safeForEach: safeForEach,
    deepClone: deepClone,
    deepMerge: deepMerge,
  };
});

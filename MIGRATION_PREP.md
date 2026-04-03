# Angular Removal: Pre-Migration Preparation

**Date:** 2026-04-03
**Current branch:** `splainer-rewrite` (based on `main` @ v2.36.4)
**Target:** Remove AngularJS entirely, convert to vanilla JS ES modules
**Note on `vanilla-simplify`:** That branch is an **earlier migration attempt**, not a known-good baseline. Do not depend on it for validation, diffs, copying code/tests, or signing off “done.” Ground truth is this document, **this** branch’s green tests (including `migrationSafetyTests.js`), and the public API contract with consumers. Elsewhere in this doc, `vanilla-simplify` is mentioned only as historical context (e.g. what stack was tried once).

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Fix Blocking Bugs First](#2-fix-blocking-bugs-first)
3. [Fix the Test Runner](#3-fix-the-test-runner)
4. [Expand Test Coverage Before Migration](#4-expand-test-coverage-before-migration)
5. [Angular API Inventory & Replacement Map](#5-angular-api-inventory--replacement-map)
6. [Introduce Shim Layer](#6-introduce-shim-layer)
7. [Decouple the DI System Incrementally](#7-decouple-the-di-system-incrementally)
8. [Plan the HTTP/$q Replacement](#8-plan-the-httpq-replacement)
9. [Modernize the Build Pipeline](#9-modernize-the-build-pipeline)
10. [Migration Order](#10-migration-order)
11. [Validation Strategy](#11-validation-strategy)

---

## 1. Current State Assessment

### What exists already

| Asset | Status |
|-------|--------|
| `migrationSafetyTests.js` | 49 test cases pinning deep-copy, null-safety, preprocessor contracts, engine routing, vector ops, transport routing, merge semantics, origin() behavior |
| `vanilla-simplify` branch | Earlier full migration experiment (Angular removed, ES modules, fetch, Vitest, Playwright) — see opening note |
| `CODE_REVIEW.md` | 34 known bugs documented, all present on both branches |
| Test coverage | 42 spec files covering most services/factories |

### Angular API usage (source files only)

| API | Occurrences | Replacement |
|-----|-------------|-------------|
| `angular.forEach` | ~124 | `Array.forEach` / `Object.entries` + null guards |
| `angular.copy` | ~92 | `structuredClone()` (Node 17+, browsers 2022+) |
| `angular.merge` | ~13 | Custom deep merge or `lodash.merge` |
| `angular.isDefined` | ~23 | `!== undefined` |
| `angular.isUndefined` | ~5 | `=== undefined` |
| `angular.isObject` | ~3 | `typeof x === 'object' && x !== null` |
| `angular.isString` | ~1 | `typeof x === 'string'` |
| `angular.fromJson` | ~19 | `JSON.parse` |
| `angular.extend` | ~1 | `Object.assign` |
| `angular.element` | ~1 | `document.createElement` |
| `angular.module` | 46 | ES module `export` / `import` |
| `$http` | 6 transport factories | `fetch` API |
| `$q` | ~37 | Native `Promise` |
| `$log` | ~28 | `console` |
| `$timeout` | ~49 | `setTimeout` |
| `$sce` | ~9 | Remove (JSONP trusted URLs) |

---

## 2. Fix Blocking Bugs First

These bugs will be **harder to diagnose after migration** because the symptoms will be ambiguous — "is this a migration regression or a pre-existing bug?" Fix them on this branch before starting migration work.

### Must fix (will cause false positives during migration testing)

| # | File | Bug | Why fix now |
|---|------|-----|-------------|
| 1 | `fieldSpecSvc.js:39` | `hasOwnProperty('unabridged')` vs `'unabridgeds'` | Drops all but last unabridged field — will look like a migration regression |
| 2 | `solrSearcherFactory.js:155,169` | `keys.splice('time', 1)` with string arg | Always removes wrong element — will confuse timing validation |
| 3 | `settingsValidatorFactory.js:137` | `candidateIds` undefined crash on empty results | Crash will be blamed on migration |
| 5 | `solrSearcherFactory.js:324` | `angular.copy` commented out in `explainOther` | The mutation side-effect will behave differently post-migration |

### Should fix (promise handling will change fundamentally)

| # | File | Bug | Why fix now |
|---|------|-----|-------------|
| 4 | `esSearcherFactory.js:320` | Missing `.catch` on `$q.all` — hangs forever | When switching to native Promise, unhandled rejections become fatal |
| 10 | Multiple files | `.catch` returns `response` instead of rejecting | Swallowed errors become visible with native Promises; fix now so tests reflect real behavior |

---

## 3. Fix the Test Runner

**The test suite cannot currently run.** Karma + ChromeHeadless crashes with a signal 6 / segfault. This is the single highest priority item — you cannot safely migrate without a green test suite.

### Actions

- [ ] **Pin Puppeteer version** — `"puppeteer": "^24.0.0"` is pulling the latest Chromium which crashes in this environment. Pin to a known-working version or switch to `karma-chrome-launcher` with system Chrome.
- [ ] **Verify all 42 spec files pass** — Run `npm test` and get a clean run before any migration work.
- [ ] **Add `npm run test:coverage`** — Wire up `karma.coverage.conf.js` (already created) so you can see baseline coverage numbers. The coverage config exists but has no npm script to invoke it.

### Longer term: consider switching test framework before migration

**Vitest** (Node-based, no browser needed for unit tests) + **Playwright** (for browser integration tests) — a stack once tried on `vanilla-simplify`; worth evaluating on **this** branch on its own merits:

- Eliminates the Karma/Chrome crash problem entirely
- Vitest runs tests ~10x faster than Karma+Chrome
- Vitest's `vi.mock()` replaces `$httpBackend` and `$provide`

---

## 4. Expand Test Coverage Before Migration

### What `migrationSafetyTests.js` covers (49 tests)

- Deep-copy semantics (DocFactory, EsDocFactory, SolrDocFactory)
- `angular.forEach` null-safety (fieldSpecSvc, normalDocsSvc)
- Preprocessor output contracts (ES, Solr, Vectara)
- Engine routing (searchSvc creates correct searcher for each engine)
- Vector operations (add, sumOf, scale, toStr)
- Transport routing (POST, GET, JSONP, BULK + proxy)
- Deep-merge semantics (all 3 preprocessors)
- `origin()` excludes functions (Algolia, Vectara, SearchApi doc factories)
- Null-safety edge cases (baseExplainSvc, solrUrlSvc, fieldSpecSvc)

### What's still missing — add these tests

#### A. `angular.forEach` null-safety in untested paths

These source locations call `angular.forEach` on values that could be `null`/`undefined`. Native `for...of` or `.forEach()` will throw on `null` — need tests to pin current behavior:

| File | Line(s) | What's iterated |
|------|---------|-----------------|
| `resolverFactory.js` | forEach on `sliceIds()` result | Returns `undefined` when `chunkSize <= 0` |
| `bulkTransportFactory.js` | forEach on `requestBatches[url]` | Could be undefined if URL not in map |
| `solrSearcherFactory.js:48` | forEach on `self.config.fields` | Could be undefined |
| `solrSearcherFactory.js:207` | forEach on `data.response.docs` | Undefined if response shape is wrong |
| `normalDocsSvc.js:90,96,102` | forEach on `fieldSpec.embeds`, `.translations`, `.functions` | Always undefined for minimal fieldSpecs (partially covered) |

#### B. `angular.copy` deep-clone edge cases

| Scenario | Why it matters |
|----------|---------------|
| Object with `Date` values | `structuredClone` preserves Dates; `JSON.parse(JSON.stringify())` converts to strings |
| Object with `undefined` values | `angular.copy` preserves `undefined`; `JSON.parse(JSON.stringify())` drops them |
| Object with circular references | `angular.copy` handles cycles; `structuredClone` does too; manual clone doesn't |
| Searcher args deep-copy in preprocessors | ES/Solr/Vectara preprocessors all copy args — pin exact output shape |

#### C. `angular.merge` vs `Object.assign` deep-merge

Currently tested for preprocessor configs. Also add:

| Scenario | Why it matters |
|----------|---------------|
| Merge with `null` source values | `angular.merge` copies `null`; `Object.assign` also copies `null` — but deep merge libs vary |
| Merge with array values | `angular.merge` replaces arrays (doesn't concat); verify replacement libs match |

#### D. `$http` response shape

Pin down the exact response objects your code expects from `$http`:

| Property | `$http` shape | `fetch` shape |
|----------|---------------|---------------|
| `response.data` | Parsed JSON body | Must use `response.json()` |
| `response.status` | HTTP status code | `response.status` (same) |
| `response.headers()` | Function returning headers | `response.headers.get()` |

Write tests that assert the response properties your `.then()` callbacks access. This makes it explicit what the fetch wrapper must provide.

#### E. `$timeout` / digest cycle behavior

| Location | Usage | Risk |
|----------|-------|------|
| `bulkTransportFactory.js` | `$timeout(timerTick, 100)` batching loop | `setTimeout` won't trigger Angular digest — but post-migration that's fine |
| Transport factories | `$timeout` for async queue | Timing behavior may change |

#### F. Module/DI wiring

Add a test that verifies the public API surface — every function/factory that consumers import:

```js
it('exports the complete public API', function() {
  // Pin down every service/factory that consumers depend on
  expect(searchSvc).toBeDefined();
  expect(fieldSpecSvc).toBeDefined();
  expect(normalDocsSvc).toBeDefined();
  // ... etc for each exported service
});
```

This acts as a smoke test that the ES module rewiring didn't lose any exports.

---

## 5. Angular API Inventory & Replacement Map

### Drop-in replacements (safe to do before full migration)

These can be swapped **one at a time** with zero behavioral change, making the final migration smaller:

```
angular.isDefined(x)    →  x !== undefined
angular.isUndefined(x)  →  x === undefined
angular.isObject(x)     →  (typeof x === 'object' && x !== null)
angular.isString(x)     →  typeof x === 'string'
angular.isNumber(x)     →  typeof x === 'number'
angular.isFunction(x)   →  typeof x === 'function'
angular.fromJson(x)     →  JSON.parse(x)
angular.toJson(x)       →  JSON.stringify(x)
angular.extend(dst, src) →  Object.assign(dst, src)
```

### Require a wrapper function (create before migration)

```
angular.forEach(obj, fn)  →  safeForEach(obj, fn)  // null-safe, handles objects+arrays
angular.copy(obj)         →  deepClone(obj)         // structuredClone or rfdc
angular.merge(dst, ...src) →  deepMerge(dst, ...src) // custom or lodash.merge
```

### Require architectural change

```
angular.module / .factory / .service / .value  →  ES module exports
$http                                          →  fetch wrapper
$q                                             →  native Promise
$q.defer()                                     →  new Promise((resolve, reject) => ...)
$log                                           →  console
$timeout                                       →  setTimeout
$sce.trustAsResourceUrl                        →  remove (only needed for JSONP)
```

---

## 6. Introduce Shim Layer

Create thin wrapper functions **now**, while still on Angular, that isolate Angular-specific calls. Then the migration becomes "swap the shim internals" rather than "find-and-replace 300 call sites."

### Recommended shims to create

**File:** `services/utilsSvc.js` (or similar)

```js
// Create these as an Angular service NOW, migrate to plain module LATER

function safeForEach(collection, callback) {
  // Matches angular.forEach behavior:
  // - null/undefined → no-op
  // - array → iterate values
  // - object → iterate key/value pairs
  // - string → iterate characters (current angular.forEach behavior)
}

function deepClone(obj) {
  // Currently: return angular.copy(obj);
  // After migration: return structuredClone(obj);
}

function deepMerge(target /*, ...sources */) {
  // Currently: return angular.merge.apply(null, arguments);
  // After migration: custom implementation or lodash.merge
}
```

**Benefit:** You can write tests against the shims, then swap internals. The 124 `angular.forEach` calls become `safeForEach` calls, and the actual Angular removal is a one-line change inside the shim.

---

## 7. Decouple the DI System Incrementally

The 46 `angular.module(...).factory/service/value` registrations are the backbone of the Angular dependency. Each one injects dependencies via DI. The migration needs to convert these to ES module imports.

### Prep steps

1. **Map the dependency graph** — Which services depend on which? Identify leaf nodes (no dependencies on other app services) that can be migrated first.

   Likely migration order (leaves → roots):
   ```
   values/* (no deps)
   → stringPatch, vectorSvc, fieldSpecSvc (utility services, no $http/$q)
   → baseExplainSvc, simExplainSvc, queryExplainSvc, explainSvc
   → *UrlSvc, *PreprocessorSvc
   → *DocFactory, docFactory
   → transportFactory, *TransportFactory
   → *SearcherFactory, searcherFactory
   → resolverFactory, settingsValidatorFactory
   → searchSvc, normalDocsSvc (top-level orchestrators)
   ```

2. **For each file, list its injected dependencies** — separate Angular built-ins (`$http`, `$q`, `$log`, `$timeout`, `$sce`) from app services (other factories/services). App service deps become `import` statements; Angular built-ins become shims or native APIs.

3. **Consider a transition pattern** — Each file can temporarily work as both:
   ```js
   // Phase 1: Still registered as Angular service, but logic is in a plain function
   function createSearcherFactory($http, $q, ...) {
     // all logic here
   }
   angular.module('o19s.splainer-search')
     .factory('SearcherFactory', ['$http', '$q', ..., createSearcherFactory]);

   // Phase 2: Remove the angular.module wrapper, export the function
   export function createSearcherFactory(httpClient, promiseLib, ...) { ... }
   ```

---

## 8. Plan the HTTP/$q Replacement

`$http` is used in 6 transport factories. This is the highest-risk replacement because:
- `$http` returns promises with `.data` (already-parsed JSON)
- `fetch` returns a Response that needs `.json()` called
- `$http` rejects on non-2xx; `fetch` only rejects on network errors
- `$httpBackend` mocking in tests has no direct `fetch` equivalent

### Recommended approach

1. **Create an HTTP wrapper** that provides the same interface as `$http`:
   ```js
   function httpClient(config) {
     return fetch(config.url, { method: config.method, ... })
       .then(response => {
         if (!response.ok) throw { status: response.status, data: null };
         return response.json().then(data => ({ data, status: response.status }));
       });
   }
   ```

2. **Write tests for the wrapper** against real behavior: status codes, JSON parsing, error shapes.

3. **For test mocking**, use one of:
   - `vitest` with `vi.fn()` / `vi.mock()` (if switching test framework)
   - `msw` (Mock Service Worker) for `fetch` interception
   - Simple manual mock: `globalThis.fetch = vi.fn().mockResolvedValue(...)`

### `$q` migration

Most `$q` usage is straightforward:
- `$q.defer()` → `new Promise((resolve, reject) => { ... })`
- `$q.all(promises)` → `Promise.all(promises)`
- `$q.reject(val)` → `Promise.reject(val)`
- `$q.when(val)` → `Promise.resolve(val)`

**Gotcha:** `$q` promises resolve asynchronously on the next `$digest`. Native Promises resolve on the microtask queue. In practice this rarely matters, but tests that use `$rootScope.$apply()` to flush promises will need to use `await` or `Promise.resolve().then(...)` chains instead.

---

## 9. Modernize the Build Pipeline

### Current (Grunt-based)

```
Gruntfile.js → grunt-contrib-concat → splainer-search.js
             → grunt-contrib-uglify → splainer-search.min.js (broken — not wired)
             → grunt-karma → test runner
             → grunt-contrib-jshint → linter (force:true, never fails)
```

### Target (modern stack)

```
esbuild → splainer-search.js (ES module bundle)
vitest → unit tests (Node, no browser needed)
playwright → browser integration tests
eslint → linter (replaces jshint)
```

### Prep steps

- [ ] Remove `force: true` from jshint so lint errors are visible now
- [ ] Wire uglify into the build task or remove the dead config
- [ ] Add `module.js` to coverage preprocessors in `karma.coverage.conf.js`
- [ ] Consider adding an `esbuild` build script alongside Grunt (can coexist during transition)

---

## 10. Migration Order

Based on dependency analysis, risk, and the ability to validate incrementally:

### Phase 0: Preparation (this document)
- [ ] Fix the 6 high-severity bugs from CODE_REVIEW.md
- [ ] Fix the test runner (Karma/Chrome crash)
- [ ] Get all 42 spec files passing green
- [ ] Add missing migration safety tests (Section 4 above)
- [ ] Create utility shims (safeForEach, deepClone, deepMerge)
- [ ] Baseline coverage report

### Phase 1: Drop-in Angular API replacements
- [ ] Replace `angular.isDefined/isUndefined/isObject/isString/isFunction/fromJson` (60+ sites)
- [ ] Replace `angular.forEach` → `safeForEach` shim (124 sites)
- [ ] Replace `angular.copy` → `deepClone` shim (92 sites)
- [ ] Replace `angular.merge` → `deepMerge` shim (13 sites)
- [ ] Remove `stringPatch.js` — replace `hasSubstr` → `includes()` (used in explainSvc)
- [ ] Run tests after each file — everything should still pass

### Phase 2: Convert DI to ES modules
- [ ] Start with leaf nodes (values/, vectorSvc, fieldSpecSvc)
- [ ] Work up the dependency tree
- [ ] Keep Angular module registration as a thin wrapper during transition
- [ ] Update tests incrementally (or keep Angular test harness until Phase 4)

### Phase 3: Replace $http, $q, $log, $timeout, $sce
- [ ] Introduce fetch wrapper with same response shape as $http
- [ ] Replace `$q` with native Promise
- [ ] Replace `$log` with `console`
- [ ] Replace `$timeout` with `setTimeout`
- [ ] Remove `$sce` (only used for JSONP trusted URLs)

### Phase 4: Remove Angular entirely
- [ ] Delete `angular.module` registration from all files
- [ ] Remove `angular` and `angular-mocks` from package.json
- [ ] Switch from Karma to Vitest (or alternative)
- [ ] Update bundle build (Grunt concat → esbuild)
- [ ] Confirm completeness via tests and requirements on **this** branch

---

## 11. Validation Strategy

### Before each phase

- All existing tests pass (green suite)
- Coverage report shows no regression

### During migration

- Run `migrationSafetyTests.js` after every change — it's the canary
- For each converted file, run its specific spec file

### After migration

- Full test suite passes
- Bundle size check (should decrease — Angular is ~170KB)
- Smoke test with a real Solr/ES instance (if available)
- Verify npm package exports match previous public API

---

## Appendix: Files Sorted by Migration Complexity

### Simple (no $http/$q, few Angular APIs)
- `values/defaultSolrConfig.js`, `defaultESConfig.js`, `defaultVectaraConfig.js`, `activeQueries.js`
- `services/stringPatch.js` (delete entirely)
- `services/vectorSvc.js` (only `angular.forEach`)
- `services/fieldSpecSvc.js` (only `angular.forEach`)
- `services/baseExplainSvc.js`, `simExplainSvc.js` (only `angular.forEach`)

### Moderate (Angular utilities but no $http)
- `services/explainSvc.js`, `queryExplainSvc.js`
- `services/normalDocsSvc.js` (heavy `angular.forEach` + `angular.copy`)
- `services/*UrlSvc.js` (3 files, use `angular.isDefined`)
- `services/*PreprocessorSvc.js` (5 files, use `angular.copy` + `angular.merge`)
- `factories/docFactory.js`, `*DocFactory.js` (5 files, use `angular.copy`)
- `factories/settingsValidatorFactory.js` (uses `angular.forEach`, `angular.copy`)

### Complex ($http, $q, $timeout — core async machinery)
- `factories/*TransportFactory.js` (5 files — GET, POST, JSONP, Proxy, Bulk)
- `factories/transportFactory.js` (routing layer)
- `factories/*SearcherFactory.js` (5 files — all use $q, some use $http indirectly)
- `factories/resolverFactory.js` (uses $q.all, angular.forEach, angular.copy)
- `services/searchSvc.js` (orchestrator — depends on everything)
- `services/transportSvc.js` (depends on all transport factories)

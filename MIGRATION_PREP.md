# Angular Removal: Migration Plan

**Date:** 2026-04-03 (started) — 2026-04-04 (Phase 2 complete, Phase 3 plan revised)  
**Current branch:** `splainer-rewrite` (based on `main` @ v2.36.4)  
**Target:** Remove AngularJS entirely, convert to vanilla JS ES modules.

**Ground truth:** This document, **this** branch’s green tests (including `migrationSafetyTests.js`), and the [public API](#public-api--semver) below. Do **not** use branch `vanilla-simplify` for validation, diffs, copying code/tests, or sign-off — it was an earlier full-stack experiment (ES modules, fetch, Vitest, Playwright). Mention it only as historical context.

**Change log:** See `MIGRATION_CHANGES.md` for a record of what changed and what didn’t in each phase.

### Public API & semver

`package.json` `main` → root `splainer-search.js`, built by Grunt (`module.js` + `services/`, `factories/`, `values/`). Consumers load that bundle with Angular as a peer. Keep response shapes, module/globals, and behavior stable unless you ship a **semver-major** release with documented breaks. After ESM, set `main` / `exports` explicitly.

---

## Table of Contents

1. [Completed Work](#1-completed-work)
2. [Test Runners](#2-test-runners)
3. [Coverage Baseline](#3-coverage-baseline)
4. [Plan the HTTP/$q Replacement](#4-plan-the-httpq-replacement)
5. [Modernize the Build Pipeline](#5-modernize-the-build-pipeline)
6. [Remaining Migration Order](#6-remaining-migration-order)
7. [Validation Strategy](#7-validation-strategy)

---

## 1. Completed Work

### Phase 1: Angular utility API replacements (complete)

All `angular.isDefined`, `isUndefined`, `isObject`, `isString`, `fromJson`, `extend`, `element` replaced with native JS equivalents. `angular.forEach`, `angular.copy`, `angular.merge` routed through `utilsSvc` shims (`safeForEach`, `deepClone`, `copyOnto`, `deepMerge`) that currently delegate to the Angular originals. Zero `angular.*` utility calls remain in source files.

### Phase 2: DI decoupling — ES module exports (complete)

All 47 source files (`services/`, `factories/`, `values/`) converted to ES modules:
- Each file exports its constructor/factory/value with `export`
- Angular `.module().service()`/`.factory()`/`.value()` registrations guarded with `if (typeof angular !== ‘undefined’)`
- Vitest set up as a dual test runner alongside Karma (6 test files, 43 tests)
- Custom `scripts/karma-strip-exports.cjs` preprocessor strips `export` keywords for Karma and Istanbul coverage
- Grunt concat `process` function strips exports from the `splainer-search.js` bundle
- Integration test `loadScript()` strips exports before `eval()`

### Shim layer (complete)

`services/utilsSvc.js` provides `safeForEach`, `deepClone`, `copyOnto`, `deepMerge`. Internals still delegate to `angular.forEach`/`angular.copy`/`angular.merge`. Phase 3 will swap internals to native implementations.

#### Deep clone contract

Call sites use **plain data** (configs, Solr/ES shapes). **`structuredClone`** is usually enough; it is **not** equivalent to `angular.copy` for functions, symbols, prototypes, DOM, or some cycles. A native-JS stub is already in `test/vitest/helpers/utilsSvcStub.js`.

### Remaining Angular API in source files

Only `angular.forEach`, `angular.copy`, `angular.merge` remain — inside `utilsSvc.js` internals only. All other source files are Angular-free except for the guarded `angular.module()` DI registrations.

| API | Where | Phase to remove |
|-----|-------|-----------------|
| `angular.forEach` | `utilsSvc.js` internals | Phase 3 (swap to native) |
| `angular.copy` | `utilsSvc.js` internals | Phase 3 (swap to `structuredClone`) |
| `angular.merge` | `utilsSvc.js` internals | Phase 3 (swap to custom `deepMerge`) |
| `angular.module()` registrations | All 47 source files (guarded) | Phase 4 (delete) |
| ~~`$log`~~ | ~~7 factories~~ | ~~Phase 3~~ — **done** (`console`) |
| ~~`$timeout`~~ | ~~1 factory (`bulkTransportFactory`)~~ | ~~Phase 3~~ — **done** (`setTimeout`/`clearTimeout`) |
| `$http` | 3 transport factories + 2 direct callers | Phase 3 Steps 1-2 (`fetch` wrapper) |
| `$sce` | 1 factory (`httpJsonpTransportFactory`) | Phase 3 Step 1 (removed with `$http.jsonp`) |
| `$q` | ~37 uses across 7 factories | Phase 3 Steps 3-5 (native `Promise`; depends on `$http` removal) |

---

## 2. Test Runners

**Karma** (primary): ChromeHeadless, `npm test` — 619 tests. Stays as the gate through Phase 3.

**Vitest** (secondary): `npm run test:vitest` — 43 tests across 6 files in `test/vitest/`. Imports ES modules directly without Angular. Uses `test/vitest/helpers/utilsSvcStub.js` for `utilsSvc` dependency.

**Integration**: `npm run test:integration` — Node.js + jsdom, real HTTP server.

**CI**: `npm run test:ci` = ESLint + Karma + Vitest + integration.

---

## 3. Coverage Baseline

**Post-Phase 2** (2026-04-04), Karma + ChromeHeadless, `npm run test:coverage`:

| Metric | Coverage | Count |
|--------|----------|-------|
| Statements | **95.72%** | 2309 / 2412 |
| Branches | **84.56%** | 871 / 1030 |
| Functions | **95.39%** | 456 / 478 |
| Lines | **95.75%** | 2299 / 2401 |

Branch dip from original 88.00% is entirely from `if (typeof angular !== ‘undefined’)` guards (47 files × 1 uncovered `false` branch). These are deleted in Phase 4.

---

## 4. Plan the HTTP/$q Replacement

### Why order matters: the `$q` coupling problem

The entire promise chain is `$q` from top to bottom:

```
$http.get/post/jsonp   →  $q promise
       ↓
transport.query()      →  $q promise
       ↓
searcher.search()      →  $q promise (chains .then/.catch on transport)
       ↓
resolver.fetchDocs()   →  $q promise ($q.all, $q.defer)
```

Angular's test infrastructure (`$httpBackend.flush()`, `$rootScope.$apply()`) resolves the **entire chain synchronously** during a digest cycle. Introducing a single native `Promise` anywhere in the chain breaks that synchronous resolution — `$q` treats native promises as async thenables, so tests that assert immediately after `flush()` fail.

**`$q` cannot be removed independently of `$http`. They are the same system.** Replacing `$http` with `fetch` is the first domino — once transport returns native promises, everything chained on it becomes native automatically, and `$q` falls away naturally.

### Migration order: bottom-up, layer by layer

Each step produces a green test suite before the next step starts.

#### Step 1: `fetch` wrapper — replace `$http` in transport factories

Create a thin `fetch` wrapper that returns the same **response shape** as `$http` (`{ data, status, statusText, headers, config }`). This is the single highest-leverage change: three transport factories (`httpPostTransportFactory`, `httpGetTransportFactory`, `httpJsonpTransportFactory`) call `$http` directly and return the result.

**Files changed:** 3 transport factories + new wrapper module
**Test impact:** Replace `$httpBackend` mocks with `fetch` mocks (per-file, scoped to transport tests)

`$http` contract to preserve:
- Success: resolves to `{ data, status, statusText, headers, config }` with parsed JSON
- Failure: rejects with same shape on 4xx/5xx (unlike `fetch`, which only rejects on network errors)
- Callers read `.data`, `.status`, `.searchError` on both success and error paths

Starting point (not final):

```js
function httpClient(config) {
  return fetch(config.url, {
    method: config.method,
    headers: config.headers,
    body: config.data ? JSON.stringify(config.data) : undefined,
  }).then((response) => {
    return response.text().then((text) => {
      var data = text ? JSON.parse(text) : null;
      var result = { data: data, status: response.status, statusText: response.statusText };
      if (!response.ok) throw result;
      return result;
    });
  });
}
```

Wrapper gets its own Vitest tests: status codes, JSON parse, rejection shape, network errors.

#### Step 2: Replace `$http.post()` in direct callers

Two files call `$http` directly (not through transport):
- `bulkTransportFactory.js` — `$http.post()` in `sendMultiSearch()`
- `esSearcherFactory.js` — `$http.post()` in `explain()`

Replace with the same `fetch` wrapper from Step 1.

**Files changed:** 2 factories
**Test impact:** Replace `$httpBackend` mocks in `bulkTransportFactory` tests; `esSearcherFactory` explain tests

#### Step 3: Replace `$q.defer()` / `$q.all()` / `$q()` constructor patterns

With all upstream promises now native, these replacements are safe:

| File | Pattern | Replacement |
|------|---------|-------------|
| `bulkTransportFactory.js` | `$q.defer()` — resolve/reject stashed on pending query objects | `new Promise()` with resolve/reject stashed on object |
| `resolverFactory.js` | `$q.defer()` + `$q.all()` — chunked fetch coordination | `return Promise.all(promises).then(...)` (eliminates deferred anti-pattern) |
| `esSearcherFactory.js` | `$q.defer()` + `$q.all()` — explainOther coordination | `return Promise.all(promises).then(...)` |
| `solrSearcherFactory.js` | `$q(function(resolve, reject) {...})` — wraps transport chain | Remove wrapper, return transport chain directly |

**Files changed:** 4 factories
**Test impact:** Tests already work with native promises after Steps 1-2; `$rootScope.$apply()` calls in resolver tests can be removed (no digest needed)

#### Step 4: Remove `$q.reject()` calls

Every remaining `$q.reject(x)` is inside a `.then()` or `.catch()` handler. With the chain fully native, replace with `throw x`.

**Files changed:** 7 factories (algolia, searchApi, vectara, solr, es, bulk, resolver)
**Test impact:** None — `throw` and `return Promise.reject()` are equivalent in native promise handlers

#### Step 5: Remove `$q` from signatures and DI arrays

Strip `$q` from function parameters and the `angular.module()` registration arrays. No behavioral change.

**Files changed:** 7 factories
**Test impact:** None

### `$sce` (JSONP)

`$sce.trustAsResourceUrl()` is used only in `httpJsonpTransportFactory.js` for JSONP trusted URLs. When `$http.jsonp()` is replaced with `fetch` in Step 1, `$sce` is removed at the same time. If JSONP support is still needed, implement it as a dynamic `<script>` tag injection in the wrapper; otherwise drop JSONP entirely.

### Test migration strategy

Each step replaces `$httpBackend` mocks with `fetch` mocks in the **same files being changed**. Options for mocking `fetch`:

- **Vitest:** `vi.stubGlobal('fetch', mockFn)` — cleanest for new tests
- **Karma:** `globalThis.fetch = jasmine.createSpy()` — works in existing Jasmine tests
- **msw:** Intercepts at the network level — good for integration tests

The transition from `$httpBackend` to `fetch` mocks happens file-by-file alongside the source changes, not as a separate bulk migration.

---

## 5. Modernize the Build Pipeline

**Current:** Grunt → ESLint → Karma → concat (with export stripping) → `splainer-search.js`; Prettier; Karma coverage with `strip-exports` preprocessor; Vitest alongside.

**Target:** esbuild bundle; Vitest as primary runner; drop Karma + Grunt.

- [ ] Optional `esbuild` script alongside Grunt during transition

---

## 6. Remaining Migration Order

### Phase 3: `$http`, `$q`, `$log`, `$timeout`, `$sce`

[§4](#4-plan-the-httpq-replacement) explains **why order matters** and describes each step in detail. Summary:

- [x] `$log` → `console` (7 factories, 0 behavioral change)
- [x] `$timeout` → `setTimeout`/`clearTimeout` (1 factory, tests updated to `jasmine.clock()`)
- [ ] **Step 1:** `fetch` wrapper + replace `$http` in 3 transport factories (+ drop `$sce`)
- [ ] **Step 2:** Replace `$http.post()` in `bulkTransportFactory` and `esSearcherFactory`
- [ ] **Step 3:** Replace `$q.defer()` / `$q.all()` / `$q()` constructor (4 factories)
- [ ] **Step 4:** Replace `$q.reject()` → `throw` in `.then()`/`.catch()` handlers (7 factories)
- [ ] **Step 5:** Remove `$q` from function signatures and DI arrays (7 factories)
- [ ] Swap `utilsSvc` internals from `angular.*` to native implementations

### Phase 4: Remove Angular

- [ ] Strip `if (typeof angular !== ‘undefined’)` registrations from all 47 files
- [ ] Delete `module.js`
- [ ] Drop `angular` / `angular-mocks` from `package.json`
- [ ] Migrate remaining Karma specs to Vitest; drop Karma
- [ ] Grunt concat → esbuild
- [ ] Sign off on **this** branch’s tests and [public API](#public-api--semver)

---

## 7. Validation Strategy

- **Before each phase:** `npm run test:ci` (ESLint + Karma + Vitest + integration); `npm run test:coverage` vs [§3 baseline](#3-coverage-baseline)
- **During:** `migrationSafetyTests.js` after changes; targeted spec per touched file
- **After:** Full suite; smaller bundle (Angular alone is ~170KB minified — expect a noticeable drop); Solr/ES smoke if possible; **public API / semver** — [Public API & semver](#public-api--semver)
- **Change log:** Update `MIGRATION_CHANGES.md` after each phase

# Angular Removal: Migration Plan

**Date:** 2026-04-03 (started) — 2026-04-04 (Phase 3 in progress)  
**Current branch:** `splainer-rewrite` (based on `main` @ v2.36.4)  
**Target:** Remove AngularJS entirely, convert to vanilla JS ES modules.

**Ground truth:** This document, **this** branch’s green tests (including `migrationSafetyTests.js`), and the [public API](#public-api--semver) below. Do **not** use branch `vanilla-simplify` for validation, diffs, copying code/tests, or sign-off — it was an earlier full-stack experiment (ES modules, fetch, Vitest, Playwright). Mention it only as historical context.

**Change log:** See `MIGRATION_CHANGES.md` for a record of what changed and what didn’t in each phase.

### Public API & semver

`package.json` `main` → root `splainer-search.js`, built by Grunt (`module.js` + `services/`, `factories/`, `values/`). Consumers load that bundle with Angular as a peer. Keep response shapes, module/globals, and behavior stable unless you ship a **semver-major** release with documented breaks. After ESM, set `main` / `exports` explicitly.

---

## Table of Contents

1. [Progress log](#1-progress-log)
2. [Test Runners](#2-test-runners)
3. [Coverage Baseline](#3-coverage-baseline)
4. [Plan the HTTP/$q Replacement](#4-plan-the-httpq-replacement)
5. [Modernize the Build Pipeline](#5-modernize-the-build-pipeline)
6. [Remaining Migration Order](#6-remaining-migration-order)
7. [Validation Strategy](#7-validation-strategy)

---

## 1. Progress log

**Do not maintain a second copy of finished phases here.** Everything already shipped (Phases 1–2, Phase 3a–b, and incremental HTTP/`Promise` work) is summarized in **`MIGRATION_CHANGES.md`** with file lists and behavioral notes.

This file stays **plan + remaining order** ([§4](#4-plan-the-httpq-replacement), [§6](#6-remaining-migration-order)). After each mergeable chunk of work, update the change log first, then adjust [§6](#6-remaining-migration-order) checkboxes below.

### Angular-related surface still in sources (snapshot)

| API | Where | Notes |
|-----|-------|--------|
| `angular.forEach` / `angular.copy` / `angular.merge` | `utilsSvc.js` only | Still delegate to Angular; swap to native in Phase 3 |
| `angular.module()` … | All 47 source files (guarded) | Removed in Phase 4 |
| `$http` | Via `httpClient` factory only | Angular registration still returns `$http` so `$httpBackend` tests work; `createFetchClient` is the fetch/script JSONP implementation for Vitest and future DI |
| `$sce` | `httpJsonpTransportFactory` | Called only when `$sce.trustAsResourceUrl` exists (Vitest passes `null`) |
| `$q` | Several factories | Reduced: no `$q.defer()` / `$q()` executor in bulk enqueue, Solr search wrapper, resolver chunked path, or ES `explainOther` coordination; many `.catch` paths still use `$q.reject()` until Step 4–5 |
| ~~`$log`~~ | — | Replaced with `console` (see change log) |
| ~~`$timeout`~~ | — | Replaced with `setTimeout`/`clearTimeout` in bulk transport (see change log) |

#### Deep clone contract (`utilsSvc`)

Call sites use **plain data** (configs, Solr/ES shapes). **`structuredClone`** is usually enough; it is **not** equivalent to `angular.copy` for functions, symbols, prototypes, DOM, or some cycles. A native-JS stub lives in `test/vitest/helpers/utilsSvcStub.js`.

---

## 2. Test Runners

**Karma** (primary): ChromeHeadless, `npm test` — on the order of 620 tests. Stays as the gate through Phase 3.

**Vitest** (secondary): `npm run test:vitest` — 70 tests across 8 spec files in `test/vitest/`. Imports ES modules directly without Angular. Uses `test/vitest/helpers/utilsSvcStub.js` where `utilsSvc` is required.

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
resolver.fetchDocs()   →  $q promise ($q.all, $q.defer)  ← chunked path now uses Promise.all (see change log)
```

**Current branch note:** `httpClient` indirection and some native `Promise` segments are already in place (`MIGRATION_CHANGES.md`, Phases 3c–d); the diagram above is the original mental model. Tests may need both `flush()` and microtask/digest flushing where the two worlds meet.

Angular's test infrastructure (`$httpBackend.flush()`, `$rootScope.$apply()`) resolves the **entire chain synchronously** during a digest cycle. Introducing a single native `Promise` anywhere in the chain breaks that synchronous resolution — `$q` treats native promises as async thenables, so tests that assert immediately after `flush()` fail.

**`$q` cannot be removed independently of `$http`. They are the same system.** Replacing `$http` with `fetch` is the first domino — once transport returns native promises, everything chained on it becomes native automatically, and `$q` falls away naturally.

### Migration order: bottom-up, layer by layer

Each step produces a green test suite before the next step starts.

#### Step 1: `fetch` wrapper — replace `$http` in transport factories

Create a thin client that returns the same **response shape** as `$http` (`{ data, status, statusText }` at minimum). **Status:** `services/httpClient.js` introduces `httpClient` (Angular factory currently returns `$http`) and `createFetchClient()` (Fetch for GET/POST, JSONP via dynamic `<script>` + optional `jsonpRequest` for tests). Transport factories inject `httpClient` instead of `$http`. Full swap of the Angular `httpClient` registration to `createFetchClient()` (and retiring `$httpBackend` for those paths) is still open.

**Files changed (so far):** 3 transport factories + `httpClient` + tests (Karma + Vitest)  
**Test impact:** Transport Karma specs can override `httpClient` with `createFetchClient({ fetch: spy })`; library Vitest covers `createFetchClient` and transport factories without Angular

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

Two files called `$http` directly (not through transport): `bulkTransportFactory.js` (`_msearch`) and `esSearcherFactory.js` (`explain`). **Status:** both use `httpClient.post()` with the same DI name; under Angular this still resolves to `$http` until Step 1’s registration is swapped to fetch.

**Test impact:** Existing `$httpBackend` expectations still apply until the `httpClient` factory stops delegating to `$http`.

#### Step 3: Replace `$q.defer()` / `$q.all()` / `$q()` constructor patterns

**Status (done for listed sites):** Native `Promise` can interleave with remaining `$q` chains; some specs use a small `flushAll` helper (alternate `Promise.resolve()` ticks and `$rootScope.$apply()`) where assertions follow `$httpBackend.flush()`.

| File | Pattern | Replacement |
|------|---------|-------------|
| `bulkTransportFactory.js` | `$q.defer()` on queued queries | `new Promise()`; `pendingQuery.resolve` / `pendingQuery.reject` |
| `resolverFactory.js` | `$q.defer()` + `$q.all()` for chunked fetch | `return Promise.all(promises).then(...)`; `throw` in `catch` |
| `esSearcherFactory.js` | `$q.defer()` + `$q.all()` for `explainOther` | `return Promise.all(promises).then(...)` |
| `solrSearcherFactory.js` | `$q(function(resolve, reject){...})` around transport | Return `transport.query(...).then(...)` directly |

**Test impact:** `docResolverSvc`, `esSearchSvc`, and `migrationSafetyTests` adjusted where microtask ordering matters; not every `$rootScope.$apply()` can be dropped yet while `$q.reject` remains downstream.

#### Step 4: Remove `$q.reject()` calls

Every remaining `$q.reject(x)` is inside a `.then()` or `.catch()` handler. With the chain fully native, replace with `throw x`.

**Files changed:** 7 factories (algolia, searchApi, vectara, solr, es, bulk, resolver)
**Test impact:** None — `throw` and `return Promise.reject()` are equivalent in native promise handlers

#### Step 5: Remove `$q` from signatures and DI arrays

Strip `$q` from function parameters and the `angular.module()` registration arrays. No behavioral change.

**Files changed:** 7 factories
**Test impact:** None

### `$sce` (JSONP)

`httpJsonpTransportFactory` still calls `$sce.trustAsResourceUrl` when the Angular `$http` JSONP path is active. `createFetchClient()` uses dynamic `<script>` tag JSONP (no `$sce`). Longer-term default transport / CORS direction is noted in **`FUTURE.md`**.

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

[§4](#4-plan-the-httpq-replacement) explains **why order matters** and describes each step in detail. Summary (see **`MIGRATION_CHANGES.md`** for details):

- [x] `$log` → `console`
- [x] `$timeout` → `setTimeout`/`clearTimeout` (bulk transport + tests)
- [x] **Step 1 (partial):** `httpClient` + `createFetchClient`; transports use `httpClient`; Angular `httpClient` still wraps `$http`
- [x] **Step 2:** `bulkTransportFactory` and `esSearcherFactory` call `httpClient.post()`
- [x] **Step 3:** Native `Promise` / `Promise.all` in bulk enqueue, resolver chunked fetch, ES `explainOther`, Solr search chain (no `$q.defer` / `$q()` for those paths)
- [ ] **Step 1 (finish):** Register `createFetchClient()` in Angular and migrate remaining `$httpBackend` tests to `fetch` mocks
- [ ] **Step 4:** Replace remaining `$q.reject(...)` in handlers with `throw` / `return Promise.reject(...)` as appropriate
- [ ] **Step 5:** Remove `$q` from factory signatures and DI arrays where no longer referenced
- [ ] Swap `utilsSvc` internals from `angular.*` to native implementations
- [ ] Optional: drop `$sce` from JSONP factory once JSONP is fully non-Angular (see `FUTURE.md` for JSONP/CORS direction)

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

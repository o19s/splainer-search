# Angular Removal: Migration Plan

**Date:** 2026-04-03 (started) — 2026-04-04 (Phase 2 complete)  
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
| `$http` | 6 transport factories | Phase 3 (`fetch` wrapper) |
| `$q` | ~37 uses across factories | Phase 3 (native `Promise`) |
| `$log` | ~28 uses | Phase 3 (`console`) |
| `$timeout` | ~49 uses | Phase 3 (`setTimeout`) |
| `$sce` | ~9 uses | Phase 3 (remove — JSONP trusted URLs only) |

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

Six transport factories use `$http`. High risk because:

- Success path: promise resolves to `{ data, status, ... }` with parsed JSON
- `fetch` needs `.json()`; only rejects on network, not 4xx/5xx
- Tests mock `$httpBackend`, not `fetch`

**Approach**

1. **`fetch` wrapper** with the same promise contract as `$http` for success **and** failure. Angular failures use a **response-shaped** object (`data`, `status`, `headers`, `config`, `statusText`); callers use `.then(, err)`, `.catch`, `$q.reject(response)` (e.g. `bulkTransportFactory.js`). **Audit all paths** before locking the wrapper — align thrown/rejected values with what those call sites read.

   Starting point only (not the final contract):

   ```js
   function httpClient(config) {
     return fetch(config.url, { method: config.method, headers: config.headers, body: config.data, ... })
       .then((response) => {
         if (!response.ok) throw { status: response.status, data: null /* fill to match $http errors */ };
         return response.json().then((data) => ({ data, status: response.status }));
       });
   }
   ```

2. **Tests** for the wrapper: status codes, JSON parse, rejection shape.

3. **Mocks:** `msw`, `globalThis.fetch = mock`, or Vitest `vi.mock`.

**`$q`:** `$q.defer()` → `new Promise((resolve, reject) => { ... })`; `$q.all` / `$q.reject` / `$q.when` → `Promise.all` / `Promise.reject` / `Promise.resolve`. **Digest vs microtasks:** rare in prod; tests that `$rootScope.$apply()` to flush may need `await` / microtask chains.

---

## 5. Modernize the Build Pipeline

**Current:** Grunt → ESLint → Karma → concat (with export stripping) → `splainer-search.js`; Prettier; Karma coverage with `strip-exports` preprocessor; Vitest alongside.

**Target:** esbuild bundle; Vitest as primary runner; drop Karma + Grunt.

- [ ] Optional `esbuild` script alongside Grunt during transition

---

## 6. Remaining Migration Order

### Phase 3: `$http`, `$q`, `$log`, `$timeout`, `$sce`

[§4](#4-plan-the-httpq-replacement); wrapper matches existing contracts.

- [ ] `fetch` wrapper (same success/error shapes as `$http`)
- [ ] `$q` → native `Promise`
- [ ] `$log` → `console`; `$timeout` → `setTimeout`; drop `$sce` for JSONP as planned
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

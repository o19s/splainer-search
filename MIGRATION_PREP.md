# Angular Removal: Pre-Migration Preparation

**Date:** 2026-04-03  
**Current branch:** `splainer-rewrite` (based on `main` @ v2.36.4)  
**Target:** Remove AngularJS entirely, convert to vanilla JS ES modules.

**Ground truth:** This document, **this** branch’s green tests (including `migrationSafetyTests.js`), and the [public API](#public-api--semver) below. Do **not** use branch `vanilla-simplify` for validation, diffs, copying code/tests, or sign-off — it was an earlier full-stack experiment (ES modules, fetch, Vitest, Playwright). Mention it only as historical context.

### Public API & semver

`package.json` `main` → root `splainer-search.js`, built by Grunt (`module.js` + `services/`, `factories/`, `values/`). Consumers load that bundle with Angular as a peer. Keep response shapes, module/globals, and behavior stable unless you ship a **semver-major** release with documented breaks. After ESM, set `main` / `exports` explicitly.

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Fix the Test Runner](#2-fix-the-test-runner)
3. [Expand Test Coverage Before Migration](#3-expand-test-coverage-before-migration)
4. [Angular API Replacements](#4-angular-api-replacements)
5. [Introduce Shim Layer](#5-introduce-shim-layer)
6. [Decouple the DI System Incrementally](#6-decouple-the-di-system-incrementally)
7. [Plan the HTTP/$q Replacement](#7-plan-the-httpq-replacement)
8. [Modernize the Build Pipeline](#8-modernize-the-build-pipeline)
9. [Migration Order](#9-migration-order)
10. [Validation Strategy](#10-validation-strategy)
11. [Appendix: Files by Complexity](#appendix-files-sorted-by-migration-complexity)

---

## 1. Current State Assessment

### What exists already

| Asset | Status |
|-------|--------|
| `migrationSafetyTests.js` | Canary suite — see [§3](#3-expand-test-coverage-before-migration). Resolver `chunkSize <= 0` lives in `docResolverSvc` spec. |
| `vanilla-simplify` | Historical experiment only — see [opening](#angular-removal-pre-migration-preparation) |
| `CODE_REVIEW.md` | Known issues (7 medium, 11 low); address or explicitly accept during migration |
| Test coverage | 43 spec files under `test/spec/` |
| `npm run test:integration` | `test/integration/chunked-resolver-fetch.integration.js`; `npm run test:ci` = ESLint + unit + integration |

### Angular API usage and replacements (canonical)

Single reference for counts and what to swap in. Tier labels: **drop-in** (direct substitute), **wrapper** (shim first — [§5](#5-introduce-shim-layer)), **arch** (structural change).

| API | ~Count | Tier | Replacement |
|-----|--------|------|-------------|
| `angular.forEach` | ~124 | wrapper | `safeForEach` — null-safe; objects, arrays, strings (char iteration) |
| `angular.copy` | ~92 | wrapper | `deepClone` — [contract](#deep-clone-contract); usually `structuredClone` for JSON-ish POJOs |
| `angular.merge` | ~13 | wrapper | `deepMerge` — custom or `lodash.merge` |
| `angular.isDefined` | ~23 | drop-in | `x !== undefined` |
| `angular.isUndefined` | ~5 | drop-in | `x === undefined` |
| `angular.isObject` | ~3 | drop-in | `typeof x === 'object' && x !== null` |
| `angular.isString` | ~1 | drop-in | `typeof x === 'string'` |
| `angular.isNumber` | (rare) | drop-in | `typeof x === 'number'` |
| `angular.isFunction` | (rare) | drop-in | `typeof x === 'function'` |
| `angular.fromJson` | ~19 | drop-in | `JSON.parse` |
| `angular.toJson` | 0 today | drop-in | `JSON.stringify` if it appears |
| `angular.extend` | ~1 | drop-in | `Object.assign` |
| `angular.element` | ~1 | drop-in | `document.createElement` |
| `angular.module` / `.factory` / `.service` / `.value` | 46 | arch | ES `import` / `export` |
| `$http` | 6 transports | arch | `fetch` wrapper — [§7](#7-plan-the-httpq-replacement) |
| `$q` | ~37 | arch | `Promise` |
| `$log` | ~28 | arch | `console` |
| `$timeout` | ~49 | arch | `setTimeout` |
| `$sce` | ~9 | arch | Remove (JSONP trusted URLs only) |

### Recent branch changes (`splainer-rewrite`)

- **`services/customHeadersJson.js`** — Safe JSON header parse; `esUrlSvc`; tests in `test/spec/customHeadersJson.js`.
- **`resolverFactory.js`** — Optional settings copied onto `config` only when defined (avoids `angular.merge` clobbering with `undefined`). Failed chunked/single fetch **reject** instead of fulfilling with a raw error.
- **`test/integration/chunked-resolver-fetch.integration.js`** — `npm run test:integration`.
- **ESLint + Prettier** — `.eslintrc.cjs`, `Gruntfile.cjs` (default: eslint → karma → concat); `npm run lint`, `format` / `format:check`; JSHint removed from the pipeline.
- **`stringPatch.js` removed** — `String.prototype.includes` at explain-service call sites (ES2015+).

---

## 2. Fix the Test Runner

Karma + ChromeHeadless (`scripts/karma-chrome-bin.js`, pinned `puppeteer`), `npm test`, and `npm run test:coverage` are wired on this branch. **Green `npm test` is the gate.**

### Vitest + Playwright (optional later)

That stack was tried on `vanilla-simplify`. Treat it as a **follow-on**, not a prerequisite for removing Angular. Stay on Karma through Phase 3 while green; pilot Vitest on a small slice if Karma blocks progress. Do not bundle “new runner” with “new HTTP layer.”

---

## 3. Expand Test Coverage Before Migration

### Already pinned (see `migrationSafetyTests.js`, `docResolverSvc.js`)

Resolver `sliceIds()` / `chunkSize <= 0`, bulk **queue** iteration (not `requestBatches[url]`), missing Solr `response.docs`, preprocessor copy/merge shapes, `$http` / `$timeout` / DI surface — unless source regresses.

### Optional later

- Same `$http` success contract across transport factories (see [§7](#7-plan-the-httpq-replacement))
- New `angular.forEach` hot paths → extend the canary file

---

## 4. Angular API Replacements

Section **§1** holds the full table (counts + tier + replacement). Here: **drop-in** = swap at call site; **wrapper** = implement behind `safeForEach` / `deepClone` / `deepMerge` then replace imports; **arch** = DI, HTTP, promises, logging, timers, `$sce` per §6–§7.

---

## 5. Introduce Shim Layer

Thin wrappers **while still on Angular** so migration is “change shim internals,” not 300 scattered edits.

**Suggested home:** `services/utilsSvc.js` (or similar).

```js
// Angular service now; plain module after migration

function safeForEach(collection, callback) {
  // angular.forEach: null/undefined no-op; array; object k/v; string → characters
}

function deepClone(obj) {
  // Now: angular.copy(obj). Later: structuredClone / fallback — see contract below.
}

function deepMerge(target /*, ...sources */) {
  // Now: angular.merge. Later: lodash.merge or custom.
}
```

#### Deep clone contract

Call sites use **plain data** (configs, Solr/ES shapes). **`structuredClone`** is usually enough; it is **not** equivalent to `angular.copy` for functions, symbols, prototypes, DOM, or some cycles. Define what `deepClone` guarantees; use **rfdc** or lossy `JSON` round-trip only where acceptable.

**Benefit:** Tests target the shims; Angular removal can be a one-liner inside each shim.

---

## 6. Decouple the DI System Incrementally

46 `angular.module(...)` registrations → ES imports. Steps:

1. **Dependency graph** — Find leaves (no deps on other app services). Validate with search for injected names or **madge** once code is ESM.

2. **Per file** — Split Angular built-ins (`$http`, `$q`, `$log`, `$timeout`, `$sce`) from app services → imports vs shims/native APIs.

3. **Transition** — Keep logic in a plain function; Angular only wires DI. Then delete the wrapper and export.

   ```js
   function createSearcherFactory($http, $q, /* ... */) {
     /* implementation */
   }
   angular.module('o19s.splainer-search')
     .factory('SearcherFactory', ['$http', '$q', /* ... */, createSearcherFactory]);

   // Later: same function, ESM — inject fetch/Promise (or shims) instead of $http/$q
   export function createSearcherFactory(httpClient, /* ... */) { /* ... */ }
   ```

**Likely order (leaves → roots):** `values/*` → utilities (`vectorSvc`, `fieldSpecSvc`) → explain services → `*UrlSvc`, `*PreprocessorSvc` → doc factories → transport → searcher → `resolverFactory`, `settingsValidatorFactory` → `searchSvc`, `normalDocsSvc`.

**File-level buckets:** [Appendix](#appendix-files-sorted-by-migration-complexity).

---

## 7. Plan the HTTP/$q Replacement

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

3. **Mocks:** `msw`, `globalThis.fetch = mock`, or Vitest `vi.mock` if you have switched runners ([§2](#2-fix-the-test-runner)).

**`$q`:** `$q.defer()` → `new Promise((resolve, reject) => { ... })`; `$q.all` / `$q.reject` / `$q.when` → `Promise.all` / `Promise.reject` / `Promise.resolve`. **Digest vs microtasks:** rare in prod; tests that `$rootScope.$apply()` to flush may need `await` / microtask chains.

---

## 8. Modernize the Build Pipeline

**Current:** Grunt → ESLint (default task) → Karma → concat → `splainer-search.js`; Prettier (`npm run format` / `format:check`); Karma coverage via `karma.coverage.conf.js`.

**Target:** esbuild bundle; Vitest (optional timing [§2](#2-fix-the-test-runner)); Playwright.

**Prep**

- [ ] `module.js` in `karma.coverage.conf.js` preprocessors
- [ ] Optional `esbuild` script alongside Grunt during transition

---

## 9. Migration Order

### Phase 0: Preparation

- [ ] Shims: `safeForEach`, `deepClone`, `deepMerge`
- [ ] Baseline coverage (`npm run test:coverage` — threshold, artifact, or PR note)

### Phase 1: Angular API → table (§1)

Mechanical edits + small PRs (one API or directory); `npm test` per batch. Rough volumes (see §1): drop-ins **~60+**; `forEach` **~124**; `copy` **~92**; `merge` **~13**.

- [ ] Drop-ins: `is*`, `fromJson`, `extend`, `element`, …
- [ ] `forEach` / `copy` / `merge` → shims

### Phase 2: DI → ES modules

Leaves first ([§6](#6-decouple-the-di-system-incrementally), [Appendix](#appendix-files-sorted-by-migration-complexity)); thin Angular wrapper until Phase 4. Update tests file-by-file **or** keep the Angular test harness until Phase 4 if that stays faster.

### Phase 3: `$http`, `$q`, `$log`, `$timeout`, `$sce`

[§7](#7-plan-the-httpq-replacement); wrapper matches existing contracts.

- [ ] `fetch` wrapper (same success/error shapes as `$http`)
- [ ] `$q` → native `Promise`
- [ ] `$log` → `console`; `$timeout` → `setTimeout`; drop `$sce` for JSONP as planned

### Phase 4: Remove Angular

- [ ] Strip `angular.module` registrations
- [ ] Drop `angular` / `angular-mocks` from `package.json`
- [ ] Vitest (or other) — optional timing [§2](#2-fix-the-test-runner)
- [ ] Grunt concat → esbuild
- [ ] Sign off on **this** branch’s tests and [public API](#public-api--semver)

---

## 10. Validation Strategy

- **Before each phase:** `npm test`; `npm run test:ci` when integration matters; coverage vs Phase 0 baseline
- **During:** `migrationSafetyTests.js` after changes; targeted spec per touched file
- **After:** Full suite; smaller bundle (Angular alone is on the order of **~170KB** minified — expect a noticeable drop); Solr/ES smoke if possible; **public API / semver** — [Public API & semver](#public-api--semver)

---

## Appendix: Files Sorted by Migration Complexity

### Simple (no `$http` / `$q`, few Angular APIs)

- `values/defaultSolrConfig.js`, `defaultESConfig.js`, `defaultVectaraConfig.js`, `activeQueries.js`
- `services/customHeadersJson.js`
- `services/vectorSvc.js`, `fieldSpecSvc.js` (`angular.forEach`)
- `services/baseExplainSvc.js`, `simExplainSvc.js` (`angular.forEach`)

### Moderate (Angular utilities, no `$http`)

- `services/explainSvc.js`, `queryExplainSvc.js`
- `services/normalDocsSvc.js` (`angular.forEach`, `angular.copy`)
- `services/*UrlSvc.js` (`angular.isDefined`)
- `services/*PreprocessorSvc.js` (`angular.copy`, `angular.merge`)
- `factories/docFactory.js`, `*DocFactory.js` (`angular.copy`)
- `factories/settingsValidatorFactory.js`

### Complex (`$http`, `$q`, `$timeout`)

- `factories/*TransportFactory.js`, `transportFactory.js`
- `factories/*SearcherFactory.js`, `resolverFactory.js`
- `services/searchSvc.js`, `services/transportSvc.js`

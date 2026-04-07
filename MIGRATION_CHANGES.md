# Migration Changes Log

Tracks behavioral and structural changes introduced during the AngularJS removal
migration (branch `splainer-rewrite`). Complements `MIGRATION_PREP.md` which
describes the plan; this file records what actually shipped. The **Appendix**
lists separate **correctness fixes** on the same branch that can change
observable behavior independent of Angular removal.

---

## 3.0 integrator checklist

Use this list before and after upgrading. Semver-major narrative and breaking-change tables: **`RELEASE_NOTES_3.0.0_DRAFT.md`**. Phase-by-phase detail: the sections below in this file.

1. **IIFE / `<script>` paths** — Bundles live under **`dist/`**. If you pointed at a **repo-root** `splainer-search.js` from a git clone, switch to **`dist/splainer-search.js`** (after `npm run build`), **`node_modules/splainer-search/dist/splainer-search.js`** when installed from npm, or the package subpaths **`splainer-search/splainer-search.js`** / **`splainer-search/splainer-search-wired.js`** (via `package.json` `exports`). Load **URI.js** first.

2. **ESM entry** — Prefer `import { … } from 'splainer-search'` or **`splainer-search/wired.js`**. CommonJS `require('splainer-search')` is unsupported unless your runtime supports **`require(esm)`** (e.g. Node **22.12+**).

3. **Cookies on cross-origin GET/POST** — Use **`createFetchClient({ credentials: 'include' })`** when the server sends the right CORS headers. JSONP still uses `<script>` tags (not `fetch` credentials).

4. **Cancellation** — Pass **`signal`** on the searcher **`config`** (5th argument to `createSearcher`). Optional default: **`createFetchClient({ signal })`**. In `.catch`, use **`isAbortError(err)`** (from **`splainer-search`** or **`splainer-search/wired.js`**) to distinguish user abort from search errors.

5. **Promise contract** — **`explain`**, **`explainOther`**, **`renderTemplate`**, and resolver **doc-fetch** paths **reject** on failure instead of resolving with an error-shaped value. Use **`.catch`**, **`try`/`await`**, or `isAbortError` as needed.

6. **Validate locally** — Run **`npm run test:ci`**. Before publish, run **`npm run pack:check`** to confirm the tarball would include **`dist/*.js`** and maps (catches `--ignore-scripts` / `files` mistakes).

Test and file counts change over time; use **`npm test`** for current Vitest totals, not numbers copied from older docs.

---

## Phase 1 — Angular utility API replacements

**Behavioral changes: None.**

All `angular.isDefined`, `angular.isUndefined`, `angular.isObject`,
`angular.isString`, `angular.fromJson`, `angular.extend`, and `angular.element`
calls in source files were replaced with native JS equivalents. These are
documented drop-in replacements (summarized in this Phase 1 section) with identical
semantics for the data types used in this codebase.

`angular.forEach`, `angular.copy`, and `angular.merge` were routed through
`utilsSvc` shims (`safeForEach`, `deepClone`, `copyOnto`, `deepMerge`).
These now use native implementations: `Array.forEach`/`Object.keys` for iteration,
`structuredClone` (with JSON-roundtrip fallback) for cloning, and a custom recursive
`deepMerge` matching `angular.merge` semantics (including index-wise array merge).

**Known semantic difference:** `deepClone` no longer preserves function-valued
properties. `angular.copy` copied function references; the JSON-roundtrip fallback
silently drops them. No call site depends on cloning functions — `origin()` pre-filters
them, and all other callers pass plain JSON data. `undefined` values inside objects are
also dropped in the fallback path (but preserved in the primary `structuredClone` path).

---

## Phase 2 — DI decoupling (ES module exports)

**Behavioral changes: None.**

Every source file in `services/`, `factories/`, and `values/` (47 files total)
was converted from an Angular IIFE +
`angular.module().service()`/`.factory()`/`.value()` registration to:

1. An exported named function (e.g. `export function solrUrlSvcConstructor(...)` for services, `export function SolrDocFactory(...)` for factories)
2. An Angular registration guarded by `if (typeof angular !== 'undefined')`

Service constructors were given a `Constructor` suffix (e.g. `explainSvcConstructor`)
to distinguish the constructor from the Angular service name. Factory functions kept
their original names (e.g. `DocFactory`, `SearcherFactory`) since those names are
already the constructor/factory identity.

### What did NOT change

- **No function logic was modified.** The constructor/factory bodies are
  identical; only the module boundary (IIFE removal, `export` keyword, guard)
  changed. Diffs that look large are Prettier reformatting indentation after
  IIFE removal.
- **No escape characters were added or removed.** Files like `solrUrlSvc.js`
  have escape arrays (`escapeChars`) that Prettier reformatted from a single
  line to one-element-per-line. The characters and their order are unchanged.
- **No Angular DI wiring changed.** The same dependency names in the same order
  are passed to `.service()`/`.factory()`. The only difference is that the
  constructor is now a named reference instead of an inline function expression.
- **No test logic changed.** All Karma tests and the integration test passed at
  Phase 2 completion (619 specs at the time); the suite has since grown — see Phase 3c–d for current approximate counts.

### Structural changes (non-behavioral)

| Change | Reason |
|--------|--------|
| IIFE wrappers removed from all `services/*.js`, `factories/*.js`, and `values/*.js` | Prerequisite for `export` syntax |
| `export` keyword added to each constructor/factory/value | Enables direct import in Vitest and future ESM consumers |
| `if (typeof angular !== 'undefined')` guard on every Angular registration | Allows files to load in Node.js (Vitest) without Angular present |
| Prettier reformatted all converted files | Consistent style after dedentation from IIFE removal |

### New infrastructure

| File | Purpose |
|------|---------|
| `vitest.config.js` | Vitest configuration — test files in `test/vitest/` |
| `scripts/karma-strip-exports.cjs` | Tiny Karma preprocessor that strips `export` keywords so files parse as scripts for Karma and Istanbul coverage |
| `test/vitest/helpers/utilsSvcStub.js` | Native-JS implementation of `utilsSvc` for Vitest (no Angular dependency) |
| `test/vitest/*.test.js` | Vitest specs for converted modules (values, simple services) |

### Build pipeline changes (Phase 2 — **superseded by Phase 4b**)

| File | Change |
|------|--------|
| `Gruntfile.cjs` | Concat `process` function strips `export` keywords from the `splainer-search.js` bundle so consumers can load it as a classic `<script>` |
| `karma.conf.js` | Uses `strip-exports` preprocessor for `services/`, `factories/`, `values/` |
| `karma.coverage.conf.cjs` | Chains `strip-exports` before `coverage` instrumenter |
| `karma.debug.conf.js` | Same as coverage config |
| `package.json` | Added `vitest`, `test:vitest` script; `test:ci` now runs Vitest too |
| `.eslintrc.cjs` | `sourceType: 'module'` override for `values/**/*.js`, `services/**/*.js`, `factories/**/*.js`, `test/vitest/**/*.js` |
| `test/integration/chunked-resolver-fetch.integration.js` | `loadScript()` strips `export` keywords before `eval()` |

Phase 4b **removed** Grunt, Karma, and export stripping; the published IIFE is now produced by **esbuild** (`build.js`). See Phase 4b.

### Coverage baseline comparison

| Metric | Before Phase 2 | After Phase 2 | Note |
|--------|----------------|---------------|------|
| Statements | 95.65% | 95.72% | Within margin |
| Branches | 88.00% | 84.56% | Expected dip — each `typeof angular` guard adds an uncovered `false` branch in Karma (47 files × 1 branch) |
| Functions | 95.53% | 95.39% | Within margin |
| Lines | 95.66% | 95.75% | Within margin |

The branch dip is not a regression. In Karma, Angular is always loaded, so the
`false` path of `if (typeof angular !== 'undefined')` is never taken. These
branches will be removed entirely in Phase 4 when Angular registration code is
deleted.

---

## Phase 3a — `$log` → `console`

**Behavioral changes: None.**

Angular's `$log` service is a thin wrapper around `console` with identical
method signatures. This codebase only uses `$log.debug()` and `$log.error()`,
both of which map 1:1 to `console.debug()` and `console.error()`.

### Files changed (7)

| File | `$log` calls replaced |
|------|----------------------|
| `factories/esSearcherFactory.js` | 4 (`debug`) |
| `factories/solrSearcherFactory.js` | 2 (`debug`) |
| `factories/searchApiSearcherFactory.js` | 2 (`error`) + 1 (`debug`) |
| `factories/algoliaSearchFactory.js` | 1 (`debug`) |
| `factories/vectaraSearcherFactory.js` | 1 (`debug`) |
| `factories/bulkTransportFactory.js` | 1 (`debug`) |
| `factories/resolverFactory.js` | 2 (`debug`) |

In each file:
1. `$log` removed from the function parameter list
2. `'$log'` removed from the Angular DI annotation array
3. `$log.debug(...)` → `console.debug(...)`, `$log.error(...)` → `console.error(...)`

### What did NOT change

- **No logging behavior changed.** The same messages are logged at the same
  levels. `console.debug` and `console.error` are the exact methods that
  Angular's `$log` delegates to.
- **No test logic changed.** No tests were injecting or mocking `$log`.
- **No other DI wiring changed.** Only `$log` was removed from each factory's
  dependency list; all other dependencies remain in the same order.

### Coverage comparison

| Metric | After Phase 2 | After Phase 3a | Note |
|--------|---------------|----------------|------|
| Statements | 95.72% | 95.72% | Identical |
| Branches | 84.56% | 84.56% | Identical |
| Functions | 95.39% | 95.39% | Identical |
| Lines | 95.75% | 95.75% | Identical |

---

## Phase 3b — `$timeout` → `setTimeout`/`clearTimeout`

**Behavioral changes: None.**

Angular's `$timeout` wraps `setTimeout` and adds a digest cycle trigger after
the callback runs. In this codebase, `$timeout` was only used in
`BulkTransportFactory` to batch Elasticsearch `_msearch` requests on a 100ms
timer. The digest integration is unnecessary because `$httpBackend.flush()` (in
tests) and Angular's `$http` (in production) already trigger digests when
promises resolve.

### Source file changed (1)

| File | Change |
|------|--------|
| `factories/bulkTransportFactory.js` | `$timeout(fn, 100)` → `setTimeout(fn, 100)`; `$timeout.cancel(promise)` → `clearTimeout(id)`; variable renamed `timerPromise` → `timerId`; `$timeout` removed from function params and DI array |

### Test files changed (3)

| File | Change |
|------|--------|
| `test/spec/bulkTransportFactory.js` | Replaced `$timeout.flush()` with `jasmine.clock().tick(100)` (8 tests); added `jasmine.clock().install()`/`uninstall()` in before/afterEach; removed `$timeout` injection |
| `test/spec/transportSvc.js` | BULK transport test: wrapped with `jasmine.clock().install()`/`uninstall()`; `$timeout.flush()` → `jasmine.clock().tick(100)` (1 test) |
| `test/spec/migrationSafetyTests.js` | Updated 2 tests: `BulkTransportFactory queue forEach` and `$timeout scheduling` → uses `jasmine.clock()` instead of `$timeout.flush()`; updated section header and comment |

### What did NOT change

- **No batching behavior changed.** The same 100ms timer drives the same
  `sendMultiSearch()` → `httpClient.post()` (still `$http` under Angular). Only the scheduling mechanism
  changed from Angular's `$timeout` to native `setTimeout`.
- **Non-BULK transport tests unchanged.** Tests for `HttpPostTransportFactory`,
  `HttpGetTransportFactory`, `HttpJsonpTransportFactory`, and `ProxyTransport`
  still call `$timeout.flush()` for Angular-internal deferred tasks — unaffected.
- **No other factories use `$timeout`.** Despite the migration plan estimating
  ~49 uses, all `$timeout` usage was confined to `bulkTransportFactory.js`.

### Coverage comparison

| Metric | After Phase 3a | After Phase 3b | Note |
|--------|----------------|----------------|------|
| Statements | 95.72% | 95.72% | Identical |
| Branches | 84.56% | 84.56% | Identical |
| Functions | 95.39% | 95.39% | Identical |
| Lines | 95.75% | 95.75% | Identical |

---

## Phase 3c — `httpClient` abstraction (`$http` indirection)

**Behavioral changes: None in production under Angular** — the registered `httpClient` factory still returns Angular’s `$http`, so existing `$httpBackend` tests and promise/digest behavior are unchanged.

Structural / preparatory changes:

| Area | What changed |
|------|----------------|
| New module | `services/httpClient.js` exports `createFetchClient(options)` — Fetch-based GET/POST with the same resolve/reject shape as `$http` (`{ data, status, statusText }`); JSONP via dynamic `<script>` (or optional `jsonpRequest` for unit tests) |
| Angular DI | `httpClient` factory wraps `$http` until Step 1 is finished (fetch registration) |
| Transports | `HttpGetTransportFactory`, `HttpPostTransportFactory`, `HttpJsonpTransportFactory` inject `httpClient` instead of `$http` |
| Direct POST | `BulkTransportFactory`, `EsSearcherFactory` use `httpClient.post()` for `_msearch` and explain |
| JSONP + `$sce` (transitional) | While Angular was still wired, `HttpJsonpTransportFactory` optionally called `$sce.trustAsResourceUrl` when injected; **`$sce` was removed entirely** later (Phase 4c). |

### Vitest & Karma tests

| Addition | Purpose |
|----------|---------|
| `test/vitest/httpClient.test.js` | Contract tests for `createFetchClient` (success, 4xx/5xx, network error, JSONP overrides / DOM mock) |
| `test/vitest/transportFactories.test.js` | Transport factories with `createFetchClient` and `TransportFactory`, no Angular |
| `test/spec/http{Get,Post,Jsonp}TransportFactory.js` | Karma: `$provide` override of `httpClient` with `createFetchClient({ fetch: spy })` or `jsonpRequest` spy (**files removed in Phase 4b**) |

### Documentation

| File | Purpose |
|------|---------|
| `FUTURE.md` | Recommends eventual JSONP deprecation in favor of Solr CORS + GET default (semver-major) |

---

## Phase 3d — Native `Promise` replacing `$q.defer` / `$q()` in selected factories

**Behavioral changes: Subtle timing only in tests** — mixing native `Promise` microtasks with `$q` means a few specs must flush both (e.g. `flushAll`: `await Promise.resolve()` in a loop with `$rootScope.$apply()`). Production behavior of batching, chunking, and search/explain flows is unchanged.

### Source changes

| File | Change |
|------|--------|
| `factories/bulkTransportFactory.js` | `enqueue()` returns `new Promise`; pending items use `resolve` / `reject` instead of `deferred`; failure paths call `pendingQuery.reject` / `currRequest.reject` / `resolve` accordingly |
| `factories/resolverFactory.js` | Chunked `fetchDocs` returns `Promise.all(promises)`; errors rethrown in `catch` (non-chunked path still used `$q.reject` until Phase 3f) |
| `factories/esSearcherFactory.js` | `explainOther` uses `Promise.all(promises).then(...)` instead of `$q.defer()` wrapping `$q.all` |
| `factories/solrSearcherFactory.js` | Solr `search` returns the transport `.query().then(...)` chain directly (no outer `$q(function (resolve, reject) { ... })` executor); `activeQueries` increment/decrement aligned with that chain |

### Test & spec hygiene

| File | Change |
|------|--------|
| `test/spec/bulkTransportFactory.js` | Expectations updated for `resolve`/`reject` on pending queue items where migration safety tests inspect internals |
| `test/spec/docResolverSvc.js` | Chunked and edge-case tests use `flushAll` instead of a single `$apply` where needed; removed unused `mockFullQueriesResp` fixture |
| `test/spec/esSearchSvc.js` | Shared `flushAll`; inject `$rootScope`; `Object.hasOwn` instead of `hasOwnProperty`; duplicate explain fixtures removed from profile-only `describe`; minor unused-variable / catch-signature fixes; async `explainOther` doc test |
| `test/spec/migrationSafetyTests.js` | Extra microtask tick after bulk failure flush where rejection is observed asynchronously |

### Dual runner counts (approximate, post Phase 3c–d)

| Runner | Count (approx.) |
|--------|------------------|
| Karma (`npm test`) | ~620 tests |
| Vitest (`npm run test:vitest`) | 70 tests in 8 files under `test/vitest/` |

---

## Phase 3e — Step 1 (finish): `createFetchClient()` as Angular default + `$httpBackend` removal

### Summary

Switched the Angular `httpClient` factory from returning `$http` to `createFetchClient()`. All HTTP traffic now flows through native `fetch` (GET/POST) or `<script>` tag injection (JSONP). Migrated all 11 `$httpBackend`-based Karma test files to a new `MockHttpBackend` helper (`test/mock/mockHttpBackend.js`, **removed again in Phase 4b** when Karma was dropped).

### Source changes

| File | Change |
|------|--------|
| `services/httpClient.js` | Angular factory returns `createFetchClient()` instead of `$http`; removed `$http` from DI array. During the transition, `jsonp()` briefly accepted Angular `$sce` trusted URL objects (coerced via `.toString()`); **that unwrap was removed in Phase 4c** once JSONP became string-only. |

### Behavioral changes (production)

Response shapes and status handling were kept aligned with `$http` (`{ data, status, statusText }`, JSON parse of bodies, structured errors on 4xx/5xx). Differences worth noting for integrators:

| Area | `$http` (before) | `fetch` (`createFetchClient`) |
|------|------------------|--------------------------------|
| Cookies | Sent according to Angular/XHR defaults for same-site requests | Pass **`createFetchClient({ credentials: 'include' })`** for credentialed cross-origin GET/POST, or a custom `fetch`; otherwise browser defaults apply (`same-origin`). JSONP is not affected. |
| Interceptors / transforms | Angular `$http` pipeline | **None** — no global request/response interceptors or `$http`-style transforms |
| JSON POST bodies | `$http` serialized objects | Non-string bodies are passed through `JSON.stringify` in `createFetchClient` (same practical effect for plain objects) |
| Error object identity | Digest-linked `$q` | Native `Promise` rejection; no `$rootScope` digest (irrelevant once Angular is gone) |
| Network failures | `$http` rejection shape varies by adapter | Rejections still use `{ data: null, status: 0, statusText: '' }`; **`cause`** may carry the underlying error for debugging |
| **`customHeaders` JSON** | Invalid JSON could surface as a hard failure depending on call path | **`customHeadersJson.tryParseObject`** logs a **console warning** and uses **empty headers** so the request may proceed → watch for sudden **401s** if config JSON is wrong (see `INTEGRATOR_SPLAINER_QUEPID.md`) |
| **Request cancellation** | Apps could cancel in-flight `$http` in some patterns | **As of 3.0.0:** pass **`config.signal`** on `createSearcher` options (and optional **`createFetchClient({ signal })`**); see **AbortSignal / cancellable search (post–Phase 4)** below. |

JSONP still uses a dynamic `<script>` tag (same class of behavior as Angular’s JSONP), so cross-origin Solr without CORS remains supported.

## Phase 3f — Steps 4 & 5: Remove `$q.reject()` and `$q` from all factories

### Summary

Replaced all remaining `$q.reject(x)` calls with `throw x` inside `.then()` / `.catch()` handlers. Removed `$q` from function signatures and Angular DI arrays in all 7 affected factories. `$q` is no longer referenced anywhere in source code.

### Behavioral notes

Rejections remain **promise rejections** with the same payloads as before; the main difference is scheduling: there is no Angular digest tied to `$q`. Any caller that mixed `$q` and native `Promise` (tests used `flushAll`-style loops) needed to flush microtasks explicitly — moot after Angular removal.

### Source changes

| File | Change |
|------|--------|
| `factories/algoliaSearchFactory.js` | `$q.reject()` → `throw`; removed `$q` from signature and DI array |
| `factories/vectaraSearcherFactory.js` | Same pattern |
| `factories/searchApiSearcherFactory.js` | Same pattern |
| `factories/solrSearcherFactory.js` | Same pattern |
| `factories/esSearcherFactory.js` | Same pattern |
| `factories/resolverFactory.js` | Same pattern |
| `factories/bulkTransportFactory.js` | Same pattern |

### Test changes (Karma / Jasmine only — **deleted in Phase 4b**)

| File | Change |
|------|--------|
| `test/mock/mockHttpBackend.js` | **Added for Karma.** `MockHttpBackend` (`expectGET` / `POST` / `JSONP` → `.respond()`) backed `fetch` / `jsonpRequest` mocks for `createFetchClient`. Removed when Karma was dropped. |
| `test/spec/transportSvc.js` | Replaced `$httpBackend` + `$timeout` with `MockHttpBackend`; tests async |
| `test/spec/proxyTransport.js` | Same pattern |
| `test/spec/bulkTransportFactory.js` | Same pattern; `flushMicrotasks` increased to 10 iterations for deeper fetch chain |
| `test/spec/solrSearchSvc.js` | Same pattern; ~55 `$httpBackend.flush()` calls removed |
| `test/spec/esSearchSvc.js` | Same pattern; `flushAll` / `$rootScope.$apply()` removed |
| `test/spec/docResolverSvc.js` | Same pattern; `flushAll` / `$rootScope.$apply()` removed |
| `test/spec/algoliaApiSearchSvc.js` | Same pattern |
| `test/spec/searchApiSearchSvc.js` | Same pattern |
| `test/spec/vectaraSearchSvc.js` | Same pattern |
| `test/spec/settingsValidatorFactory.js` | Same pattern |
| `test/spec/migrationSafetyTests.js` | `$httpBackend` blocks migrated; non-HTTP blocks untouched |

### Dual runner counts (post Phase 3e–f, pre–Phase 4b)

| Runner | Count (approx.) |
|--------|------------------|
| Karma (`npm test`) | ~620 tests (0 failures) — runner **removed** in Phase 4b |
| Vitest (`npm run test:vitest`) | ~70 tests in 8 files — suite **expanded** in Phase 4b |
| Integration (`npm run test:integration`) | Chunked resolver fetch OK |

---

## Phase 3 (tail) — `utilsSvc` native implementations

**Behavioral changes: None.**

`utilsSvc` internals (`forEach`, `deepClone`, `deepMerge`) were swapped from
`angular.forEach` / `angular.copy` / `angular.merge` to native implementations
in a prior commit. No Angular APIs remain in `utilsSvc.js`.

---

## Phase 4a — Strip Angular registration guards and delete `module.js`

**Behavioral changes: Angular DI registration no longer occurs.** Consumers
that relied on `angular.module('o19s.splainer-search')` will need to import
ES module exports directly instead.

### What changed

| Area | Change |
|------|--------|
| 48 source files (`services/`, `factories/`, `values/`) | Removed `if (typeof angular !== 'undefined') { angular.module(...).factory/service/value(...) }` blocks and their `// Angular DI registration (removed in Phase 4)` comments |
| `module.js` | **Deleted** — the `angular.module('o19s.splainer-search', [])` declaration |
| `Gruntfile.cjs` | Removed `module.js` from `eslint.target` and `concat.dist.src` |
| `package.json` | Removed `module.js` from `ignore` list and `lint` script |
| `test/integration/chunked-resolver-fetch.integration.js` | Node ESM integration script — imports from `serviceFactory.js` instead of Angular bootstrap; injects `jsonpRequest` via `createFetchClient()` for Node-native HTTP (no jsdom dependency) |
| `karma.conf.js` | Removed `module.js` from `files` |
| `karma.debug.conf.js` | Removed `module.js` from `files` and `preprocessors` |
| `karma.coverage.conf.cjs` | Removed `module.js` from `files` and `preprocessors`; updated comment |
| `stryker.conf.json` | Removed `module.js` from `mutate`; **`testRunner` → Vitest** via `@stryker-mutator/vitest-runner` (Karma runner removed — it depended on the same Angular module as `npm test`) |
| `.npmignore` | Removed `module.js` entry |
| `.eslintrc.cjs` | Scoped `angular` / `inject` globals to Karma/Jasmine files only (`test/spec`, `test/mock`); added ESM override for `test/integration/**/*.js` |
| `package.json` | Updated description; removed Karma from `test:ci` (Angular DI no longer available) |

### What did NOT change

- **ES module exports and library logic** (aside from wiring) were unchanged by Phase 4a.
- **Integration test** still passes (chunked resolver JSONP with real HTTP server).

### What broke until Phase 4b

- **Karma / Jasmine** still assumed `angular.module('o19s.splainer-search')` registrations. Immediately after Phase 4a, `npm test` (Karma) **failed** until Karma was removed and specs were ported to Vitest (Phase 4b).

### Runner counts (post Phase 4a only — historical)

| Runner | Count |
|--------|-------|
| Vitest (`npm run test:vitest`) | Growing suite (see Phase 4b) |
| Integration (`npm run test:integration`) | Chunked resolver fetch OK |
| Karma (`npm test`) | **Failed** — no Angular module |

---

## Phase 4b — Drop Grunt/Karma; Vitest as primary; ESM package + esbuild IIFE

### Summary

Removed the legacy toolchain (Grunt concat, Karma, Jasmine specs under `test/spec/`, Karma helpers under `test/mock/`). **Vitest** is now the only unit/integration-style runner (`npm test`). The library ships as **native ESM** with a separate **IIFE** bundle for `<script>` tags.

### Structural changes

| Area | Change |
|------|--------|
| Deleted | `Gruntfile.cjs`, `karma.conf.js`, `karma.coverage.conf.cjs`, `karma.debug.conf.js`, `scripts/karma-strip-exports.cjs`, `scripts/karma-chrome-bin.js`, all of `test/spec/`, all of `test/mock/` |
| Added | `build.js` (esbuild → **`dist/splainer-search.js`** IIFE `globalThis.SplainerSearch` and **`dist/splainer-search-wired.js`** IIFE `globalThis.SplainerSearchWired`), `index.js` (barrel re-exports), **`wired.js`** (pre-wired graph for Splainer/Quepid), `shims/urijs-global.js` (IIFE maps `import URI from 'urijs'` → `globalThis.URI`) |
| `package.json` | `"type": "module"`, `"main": "index.js"`, `"exports"` for `"."`, **`"./wired"` / `"./wired.js"`**, `"./splainer-search.js"` → **`dist/splainer-search.js`**, **`"./splainer-search-wired.js"`** → **`dist/splainer-search-wired.js`**; **Angular removed** from dependencies; `npm test` → `vitest run`; `test:ci` → ESLint + Vitest + integration |
| Vitest | Karma specs and migration-safety coverage **ported** into `test/vitest/` (counts drift over time — run `npm test` for current totals) |
| Stryker | Remains on `@stryker-mutator/vitest-runner` |

### Behavioral / consumer impacts (semver-relevant)

| Topic | Detail |
|-------|--------|
| **npm / Node consumers** | Default entry is **`index.js` (ESM)**. Import named exports (`import { createFetchClient } from 'splainer-search'`, etc.). CommonJS `require()` of this package is **not** supported unless you add a separate CJS build (none shipped here). |
| **Browser `<script>` consumers** | Run `npm run build` (or use prebuilt IIFEs in published `files`). **`dist/splainer-search.js`** → **`globalThis.SplainerSearch`** (constructors / manual wiring). **`dist/splainer-search-wired.js`** → **`globalThis.SplainerSearchWired`** (`createWiredServices`, `createFetchClient`, …). **URI.js** must be loaded first so `globalThis.URI` exists (see `shims/urijs-global.js`). Package subpaths **`splainer-search/splainer-search.js`** and **`splainer-search/splainer-search-wired.js`** still resolve via `exports`. |
| **Splainer / Quepid-style apps** | Prefer ESM **`import … from 'splainer-search/wired.js'`** (or **`'splainer-search/wired'`**) — same graph as `test/vitest/helpers/serviceFactory.js` / `wired/wiring.js`. Documented in **`INTEGRATOR_SPLAINER_QUEPID.md`**. |
| **Compared to pre-migration Grunt bundle** | No runtime `export` stripping; ESM sources are first-class. IIFE shape is esbuild-generated (namespace object) rather than hand-concat — verify any code that reached into globals. |
| **Tests / CI** | No Chrome/Karma; CI is Node + Vitest + jsdom where needed + integration script. |

**Behavioral changes in search/HTTP logic:** None introduced by Phase 4b itself — this phase is tooling, packaging, and test relocation.

---

## Phase 4c — Remove `$sce` from the JSONP transport

### Summary

Angular’s strict contextual escaping (`$sce`) is no longer used anywhere. JSONP URLs are treated as **ordinary strings** end-to-end.

### Source / API changes

| File | Change |
|------|--------|
| `factories/httpJsonpTransportFactory.js` | Signature is `HttpJsonpTransportFactory(TransportFactory, httpClient)` — **`$sce` removed**; no `trustAsResourceUrl` call. |
| `services/httpClient.js` | `jsonp()` no longer coerces non-string URLs via `.toString()` (that path existed for SCE-wrapped values). |
| `test/vitest/helpers/serviceFactory.js` | Test wiring helpers no longer take a `$sce` argument when building JSONP/search stacks. |

### Behavioral notes

- **Typical Solr/OpenSearch JSONP** already used string URLs — **no change** for those callers.
- **Custom integrations** that passed Angular `$sce` trusted URL objects into JSONP must now pass a **string** (e.g. unwrap before calling the transport).

---

## AbortSignal / cancellable search (post–Phase 4)

**Behavioral changes:** Optional enhancement — callers that omit `config.signal` behave as before.

| Area | Change |
|------|--------|
| `services/httpClient.js` | Optional default `options.signal` for GET/POST; per-request `config.signal` overrides when **not** `undefined`. **`AbortError`** from `fetch` is rethrown without wrapping. `jsonp()` accepts `config.signal` (reject if already aborted; listen for `abort`, remove `<script>`, reject with `AbortError`). |
| `services/transportRequestOpts.js` | **`transportRequestOpts(config)`** and **`isAbortError(err)`** for integrators. |
| `factories/http*TransportFactory.js`, `httpProxyTransportFactory.js` | Optional 4th argument **`requestOpts`** with **`signal`**, passed to `httpClient`. |
| `factories/bulkTransportFactory.js` | Each enqueue stores `signal`; **`_msearch` POST** uses **`AbortSignal.any`** when defined, else a composite **`AbortController`**. |
| Searcher factories (Solr, ES, Vectara, Algolia, Search API) | Pass **`transportRequestOpts(self.config)`** into `.query()`; **`explain`** (ES) passes **`config.signal`** into `httpClient.post`. **AbortError** skips generic `searchError` / `formatError` wrapping in failure handlers. |
| `factories/solrSearcherFactory.js` | **`pager()`** copies **`config.signal`** into page config; **`explainOther`** copies **`signal`** into the inner searcher config. |
| `factories/esSearcherFactory.js` | **`explainOther`** copies **`signal`** and **`proxyUrl`** into the inner searcher config. |
| `factories/resolverFactory.js` | Optional **`signal`** on resolver **`settings`** is forwarded into **`createSearcher`** config. |
| `index.js` | Exports **`transportRequestOpts`**, **`isAbortError`**. |

---

## Appendix — Correctness fixes shipped on `splainer-rewrite` (not only “Angular removal”)

The branch contains **behavior-changing bug fixes** relative to older line releases (see git history on `splainer-rewrite`, e.g. `0803b0c`, `b1ea256`, `10ad14b`, `eb2e09d`, `d3adade`, `7446e52`). Themes include: field / highlight handling, timed query array mutation, `explainOther` side effects and promise completion, empty Elasticsearch result edge cases, bulk/timer lifecycle, safer JSON header parsing, URL encoding, and **JSONP Basic-auth userinfo parsing** (split only on the **first** `:` so passwords may contain `:`). **Upgrading for the migration may therefore change observable results** even where HTTP and Angular are unrelated — treat release notes + this appendix as signal to re-validate explain, resolver, and search edge cases.

---

# Migration Changes Log

Tracks behavioral and structural changes introduced during the AngularJS removal
migration (branch `splainer-rewrite`). Complements `MIGRATION_PREP.md` which
describes the plan; this file records what actually shipped.

---

## Phase 1 — Angular utility API replacements

**Behavioral changes: None.**

All `angular.isDefined`, `angular.isUndefined`, `angular.isObject`,
`angular.isString`, `angular.fromJson`, `angular.extend`, and `angular.element`
calls in source files were replaced with native JS equivalents. These are
documented drop-in replacements (see `MIGRATION_PREP.md` §4) with identical
semantics for the data types used in this codebase.

`angular.forEach`, `angular.copy`, and `angular.merge` were routed through
`utilsSvc` shims (`safeForEach`, `deepClone`, `copyOnto`, `deepMerge`) that
currently delegate to the Angular originals. No call-site behavior changed.

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

### Build pipeline changes

| File | Change |
|------|--------|
| `Gruntfile.cjs` | Concat `process` function strips `export` keywords from the `splainer-search.js` bundle so consumers can load it as a classic `<script>` |
| `karma.conf.js` | Uses `strip-exports` preprocessor for `services/`, `factories/`, `values/` |
| `karma.coverage.conf.cjs` | Chains `strip-exports` before `coverage` instrumenter |
| `karma.debug.conf.js` | Same as coverage config |
| `package.json` | Added `vitest`, `test:vitest` script; `test:ci` now runs Vitest too |
| `.eslintrc.cjs` | `sourceType: 'module'` override for `values/**/*.js`, `services/**/*.js`, `factories/**/*.js`, `test/vitest/**/*.js` |
| `test/integration/chunked-resolver-fetch.integration.js` | `loadScript()` strips `export` keywords before `eval()` |

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
| JSONP + `$sce` | `HttpJsonpTransportFactory` calls `$sce.trustAsResourceUrl` only when `$sce` provides it (non-Angular / Vitest callers can pass `null`) |

### Vitest & Karma tests

| Addition | Purpose |
|----------|---------|
| `test/vitest/httpClient.test.js` | Contract tests for `createFetchClient` (success, 4xx/5xx, network error, JSONP overrides / DOM mock) |
| `test/vitest/transportFactories.test.js` | Transport factories with `createFetchClient` and `TransportFactory`, no Angular |
| `test/spec/http{Get,Post,Jsonp}TransportFactory.js` | Karma: `$provide` override of `httpClient` with `createFetchClient({ fetch: spy })` or `jsonpRequest` spy |

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
| `factories/resolverFactory.js` | Chunked `fetchDocs` returns `Promise.all(promises)`; errors rethrown in `catch` (non-chunked path still uses `$q.reject` for failure propagation) |
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

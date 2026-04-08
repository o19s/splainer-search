# Migration Changes Log

This file is the long-form log of the AngularJS removal migration: what changed phase by phase, which files moved, and where behavior stayed the same. The work lives on branch `splainer-rewrite` (branched from `main` at v2.36.4). At the end, an **Appendix** calls out **correctness fixes** that can change observable results even when you are not “doing anything Angular-related.”

Do not treat the older **`vanilla-simplify`** branch as canonical for validation, diffs, or copying code or tests—it was an early experiment (ESM, `fetch`, Vitest, Playwright) and is only historical context.

For semver and the public API surface, treat `package.json` `exports` and the **3.0 integrator checklist** below as the contract. Breaking changes belong in a major release; user-facing upgrade notes live in [RELEASE_NOTES_3.0.0_DRAFT.md](RELEASE_NOTES_3.0.0_DRAFT.md) (or the published 3.0.0 notes once they exist).

---

## 3.0 integrator checklist

Walk this before and after you bump the dependency. Story-style breaking changes and tables: [RELEASE_NOTES_3.0.0_DRAFT.md](RELEASE_NOTES_3.0.0_DRAFT.md). File-by-file and phase detail: the rest of *this* document.

1. **IIFE / `<script>` paths** — Built bundles sit under `dist/`. If you used a repo-root `splainer-search.js` from a git checkout, use `dist/splainer-search.js` after `npm run build`, or `node_modules/splainer-search/dist/splainer-search.js` from npm, or the stable subpaths `splainer-search/splainer-search.js` and `splainer-search/splainer-search-wired.js` from `exports`. Load URI.js before the IIFE.

2. **ESM entry** — Prefer `import { ... } from 'splainer-search'` or `splainer-search/wired.js`. `require('splainer-search')` only works where your runtime supports `require(esm)` (for example Node 22.12+).

3. **Cookies on cross-origin GET/POST** — Use `createFetchClient({ credentials: 'include' })` when CORS allows it. JSONP still goes through a `<script>` tag, not fetch credentials.

4. **Cancellation** — Put `signal` on the searcher `config` (fifth argument to `createSearcher`), or default it with `createFetchClient({ signal })`. In `.catch`, use `isAbortError(err)` from `splainer-search` or `splainer-search/wired.js` so user cancel does not look like a search failure.

5. **Promise contract** — `explain`, `explainOther`, `renderTemplate`, and resolver doc-fetch **reject** on failure instead of resolving with an error-shaped object. Use `.catch`, `try`/`await`, or `isAbortError` as appropriate. Examples: [RELEASE_NOTES_3.0.0_DRAFT.md](RELEASE_NOTES_3.0.0_DRAFT.md) → **Promise rejection contract**.

6. **Validate locally** — Run `npm run test:ci` and `npm run pack:check` before you ship. Why `pack:check` and a quick IIFE smoke path: same release notes → **Validation**. For an up-to-date Vitest count, run `npm test`; do not paste totals from old docs.

---

## Phase 1 — Angular utility API replacements

**Behavioral changes:** None for the helpers below, aside from the `deepClone` caveat at the end.

Straight `angular.isDefined`, `angular.isUndefined`, `angular.isObject`, `angular.isString`, `angular.fromJson`, `angular.extend`, and `angular.element` usage was swapped for native equivalents. For the shapes this codebase actually uses, they behave the same as before.

`angular.forEach`, `angular.copy`, and `angular.merge` already went through `utilsSvc` (`safeForEach`, `deepClone`, `copyOnto`, `deepMerge`). Those helpers now sit on native code: `Array.forEach` / `Object.keys` for loops, `structuredClone` with a JSON round-trip fallback for cloning, and a recursive `deepMerge` that still follows `angular.merge` rules (including merging arrays index by index).

**Known semantic difference:** `deepClone` does not keep function-valued properties when it falls back to JSON—`angular.copy` used to keep the reference. Nothing in-tree clones functions in practice (`origin()` strips them; other callers pass plain JSON). `undefined` inside objects is also dropped on the JSON fallback path but survives when `structuredClone` succeeds.

---

## Phase 2 — DI decoupling (ES module exports)

**Behavioral changes:** None—the bodies of services, factories, and values did not change.

All 47 files under `services/`, `factories/`, and `values/` used to live in an Angular IIFE and register with `angular.module().service()` / `.factory()` / `.value()`. Each file now:

1. Exports a named function (for example `export function solrUrlSvcConstructor(...)` on the service side, `export function SolrDocFactory(...)` for factories).
2. Keeps Angular registration behind `if (typeof angular !== 'undefined')`.

Services picked up a `Constructor` suffix so the export name does not collide with the Angular service label (`explainSvcConstructor` vs `explainSvc`). Factories already went by their real names (`DocFactory`, `SearcherFactory`), so those stayed as-is.

### What did NOT change

- Constructor and factory **bodies** are unchanged—only the wrapper (IIFE removal, `export`, guard). Huge-looking diffs are mostly Prettier re-indent after dropping the IIFE.
- Escape tables such as `escapeChars` in `solrUrlSvc.js` were only reformatted (one entry per line); the characters and order are the same.
- Angular DI lists are the same strings in the same order; the only structural change is referencing a named export instead of an inline function.
- Test expectations were unchanged at Phase 2 completion (619 Karma specs at the time, plus the integration test). Counts have moved since—see Phase 3c–d for later runner notes.

### Structural changes (non-behavioral)

- Dropped IIFEs from every `services/*.js`, `factories/*.js`, and `values/*.js` file so `export` is legal.
- Added `export` on each constructor, factory, or value so Vitest and future ESM callers can import directly.
- Wrapped each Angular registration in `typeof angular` so the same files load in Node for Vitest without a global Angular.
- Ran Prettier across the touched files after dedenting.

### New infrastructure

- `vitest.config.js` — Vitest entry; specs live under `test/vitest/`.
- `scripts/karma-strip-exports.cjs` — Karma preprocessor that stripped `export` so Istanbul and the browser runner still saw classic scripts.
- `test/vitest/helpers/utilsSvcStub.js` — `utilsSvc` stub with no Angular.
- `test/vitest/*.test.js` — first Vitest coverage for values and small services.

### Build pipeline changes (Phase 2 — superseded by Phase 4b)

At this point in history, Grunt concat stripped `export` from the big `splainer-search.js` bundle; Karma used the same strip step on `services/`, `factories/`, and `values/`; coverage and debug Karma configs chained that preprocessor; `package.json` gained Vitest and `test:vitest`, and `test:ci` started calling Vitest; `.eslintrc.cjs` treated those trees as modules; the chunked resolver integration script stripped `export` before `eval()`.

Phase 4b later **deleted** Grunt, Karma, and export stripping—the shipped IIFE comes from **esbuild** (`build.js`) now. See Phase 4b for the current story.

### Coverage baseline comparison

| Metric | Before Phase 2 | After Phase 2 | Note |
|--------|----------------|---------------|------|
| Statements | 95.65% | 95.72% | Within noise |
| Branches | 88.00% | 84.56% | Each new `typeof angular` guard adds a `false` branch Karma never exercises (47 files) |
| Functions | 95.53% | 95.39% | Within noise |
| Lines | 95.66% | 95.75% | Within noise |

That branch drop is expected, not a coverage regression: under Karma, Angular is always defined, so the guard’s else path is dead until Phase 4 removes registration entirely.

---

## Phase 3a — `$log` → `console`

**Behavioral changes:** None.

`$log` in Angular is just `console` with the same method shapes. We only ever used `$log.debug` and `$log.error`, which map directly to `console.debug` and `console.error`.

Seven factories dropped `$log` from their parameter lists and DI arrays and now call `console` directly:

- `factories/esSearcherFactory.js` — 4× `debug`
- `factories/solrSearcherFactory.js` — 2× `debug`
- `factories/searchApiSearcherFactory.js` — 2× `error`, 1× `debug`
- `factories/algoliaSearchFactory.js` — 1× `debug`
- `factories/vectaraSearcherFactory.js` — 1× `debug`
- `factories/bulkTransportFactory.js` — 1× `debug`
- `factories/resolverFactory.js` — 2× `debug`

### What did NOT change

- Log text and severity are the same as before.
- No specs were injecting or stubbing `$log`.
- Every other dependency on those factories is unchanged; only `$log` left the list.

### Coverage comparison

| Metric | After Phase 2 | After Phase 3a | Note |
|--------|---------------|----------------|------|
| Statements | 95.72% | 95.72% | Identical |
| Branches | 84.56% | 84.56% | Identical |
| Functions | 95.39% | 95.39% | Identical |
| Lines | 95.75% | 95.75% | Identical |

---

## Phase 3b — `$timeout` → `setTimeout`/`clearTimeout`

**Behavioral changes:** None.

`$timeout` is `setTimeout` plus a digest kick after the callback. The only use here was `BulkTransportFactory`, which debounces Elasticsearch `_msearch` batches on a 100 ms timer. That extra digest was redundant: tests already flush `$httpBackend`, and production `$http` still schedules digests when promises settle.

`factories/bulkTransportFactory.js` now uses `setTimeout(fn, 100)` and `clearTimeout(id)` instead of `$timeout` / `$timeout.cancel`, renames `timerPromise` → `timerId`, and drops `$timeout` from params and DI.

Karma specs that advanced the bulk timer switched to Jasmine’s fake clock:

- `test/spec/bulkTransportFactory.js` — eight tests use `jasmine.clock().tick(100)` with install/uninstall in hooks; `$timeout` injection removed.
- `test/spec/transportSvc.js` — one BULK case wraps the test in the fake clock and ticks 100 ms instead of `$timeout.flush()`.
- `test/spec/migrationSafetyTests.js` — two bulk-queue tests and the section header/comments now describe `jasmine.clock()` instead of `$timeout.flush()`.

### What did NOT change

- The 100 ms batching window and the `sendMultiSearch()` → `httpClient.post()` path (still backed by `$http` in Angular) are the same—only the timer primitive changed.
- Other transport specs that still call `$timeout.flush()` for Angular’s own deferred work were left alone.
- Despite early estimates of many `$timeout` call sites, only `bulkTransportFactory.js` actually used it.

### Coverage comparison

| Metric | After Phase 3a | After Phase 3b | Note |
|--------|----------------|----------------|------|
| Statements | 95.72% | 95.72% | Identical |
| Branches | 84.56% | 84.56% | Identical |
| Functions | 95.39% | 95.39% | Identical |
| Lines | 95.75% | 95.75% | Identical |

---

## Phase 3c — `httpClient` abstraction (`$http` indirection)

**Behavioral changes:** None in production while Angular was still the runtime—the DI `httpClient` factory still handed back `$http`, so Karma’s `$httpBackend` suites and digest timing behaved as before.

This phase was mostly plumbing so transports could target one abstraction:

- Added `services/httpClient.js` with `createFetchClient(options)` for Fetch-based GET/POST that resolves/rejects like `$http` (`{ data, status, statusText }`), plus JSONP through a dynamic `<script>` (tests can inject `jsonpRequest` instead).
- Registered `httpClient` in Angular as a thin wrapper around `$http` until Phase 3e switched the default implementation to `createFetchClient()`.
- `HttpGetTransportFactory`, `HttpPostTransportFactory`, and `HttpJsonpTransportFactory` now take `httpClient` instead of `$http`.
- `BulkTransportFactory` and `EsSearcherFactory` call `httpClient.post()` for `_msearch` and explain.
- JSONP still optionally flowed through `$sce.trustAsResourceUrl` while Angular was present; **`$sce` was deleted later** in Phase 4c.

### Vitest & Karma tests

- `test/vitest/httpClient.test.js` — contract coverage for happy path, HTTP errors, network failure, and JSONP hooks / DOM mocks.
- `test/vitest/transportFactories.test.js` — transport factories wired with `createFetchClient` and `TransportFactory`, no Angular.
- `test/spec/httpGetTransportFactory.js`, `httpPostTransportFactory.js`, `httpJsonpTransportFactory.js` — Karma overrides of `httpClient` with spied `createFetchClient` / `jsonpRequest` (these specs went away when Karma did in Phase 4b).

### Documentation

- `FUTURE.md` — notes a possible future JSONP deprecation in favor of Solr CORS + GET defaults (would be semver-major).

---

## Phase 3d — Native `Promise` replacing `$q.defer` / `$q()` in selected factories

**Behavioral changes:** Only test timing got fussier—mixing native `Promise` microtasks with `$q` meant some specs needed a combined flush (for example `flushAll` spinning on `await Promise.resolve()` plus `$rootScope.$apply()`). Batching, chunking, and search/explain behavior in production stayed the same.

### Source changes

- `factories/bulkTransportFactory.js` — `enqueue()` returns `new Promise`; queue entries hold `resolve` / `reject` instead of a `$q` deferred; failure paths call the right resolver on each pending item.
- `factories/resolverFactory.js` — chunked `fetchDocs` uses `Promise.all`; errors propagate from `catch` (the non-chunked path still used `$q.reject` until Phase 3f).
- `factories/esSearcherFactory.js` — `explainOther` chains on `Promise.all(...).then(...)` instead of wrapping `$q.all` in `$q.defer()`.
- `factories/solrSearcherFactory.js` — Solr `search` returns the transport `.query().then(...)` pipeline directly (no outer `$q((resolve, reject) => …)` shell); `activeQueries` bookkeeping follows that chain.

### Test & spec hygiene

- `test/spec/bulkTransportFactory.js` — migration-safety expectations now look at `resolve` / `reject` fields on queued work.
- `test/spec/docResolverSvc.js` — chunked paths use `flushAll` where a single `$apply` was too thin; dropped unused `mockFullQueriesResp`.
- `test/spec/esSearchSvc.js` — shared `flushAll`, `$rootScope` injection, `Object.hasOwn`, trimmed duplicate explain fixtures, small lint fixes, async `explainOther` coverage.
- `test/spec/migrationSafetyTests.js` — one extra microtask hop after bulk failure so async rejections are observable.

### Dual runner counts (approximate, post Phase 3c–d)

| Runner | Count (approx.) |
|--------|------------------|
| Karma (`npm test`) | ~620 tests |
| Vitest (`npm run test:vitest`) | 70 tests in 8 files under `test/vitest/` |

---

## Phase 3e — Step 1 (finish): `createFetchClient()` as Angular default + `$httpBackend` removal

### Summary

The Angular `httpClient` registration stopped returning `$http` and started returning `createFetchClient()`, so real traffic went through `fetch` for GET/POST and through a dynamic `<script>` for JSONP. Eleven Karma suites that used `$httpBackend` were rewritten against a `MockHttpBackend` helper in `test/mock/mockHttpBackend.js` (that helper **went away with Karma** in Phase 4b).

### Source changes

- `services/httpClient.js` — DI now constructs `createFetchClient()`; `$http` left the injector list. For a short while `jsonp()` still accepted `$sce` wrappers and stringified them; **Phase 4c** removed that path once JSONP required plain strings.

### Behavioral changes (production)

Successful responses still look like `$http`: `{ data, status, statusText }`, JSON bodies parsed, structured failures on 4xx/5xx. Integrators should still read the differences:

- **Cookies** — Angular/XHR defaults no longer apply automatically. Use `createFetchClient({ credentials: 'include' })` (or inject your own `fetch`) when you need credentialed cross-origin GET/POST; otherwise you get normal fetch defaults (`same-origin`). JSONP is unchanged (still not `fetch`).
- **Interceptors / transforms** — There is no global `$http` pipeline; wrap the `fetch` you pass to `createFetchClient` if you need cross-cutting behavior.
- **JSON POST bodies** — Non-string bodies go through `JSON.stringify` inside `createFetchClient`, matching typical `$http` behavior for plain objects.
- **Promise / digest linkage** — Rejections are native promises, not `$q`; no `$rootScope` digest (only matters while Angular was still booted).
- **Network failures** — Rejections keep `{ data: null, status: 0, statusText: '' }`; the underlying error may appear on **`cause`** for debugging.
- **`customHeaders` JSON** — Bad JSON now warns in the console and drops custom headers instead of always throwing, which can surface as surprise **401s**; see **`customHeaders` JSON parsing** in [RELEASE_NOTES_3.0.0_DRAFT.md](RELEASE_NOTES_3.0.0_DRAFT.md).
- **Cancellation** — Use `config.signal` on `createSearcher` (and optionally `createFetchClient({ signal })`); full detail under **AbortSignal / cancellable search (post–Phase 4)** below.

JSONP remains a script-tag transport, so the “no CORS, still talk to Solr” story survives.

## Phase 3f — Steps 4 & 5: Remove `$q.reject()` and `$q` from all factories

### Summary

Every remaining `$q.reject(x)` became `throw x` inside promise continuations, and `$q` disappeared from factory parameters and DI lists across seven files. After this phase, **no source file references `$q`.**

### Behavioral notes

Failures are still normal promise rejections with the same payloads; the shift is scheduling—there is no `$q` digest hop. Specs that interleaved `$q` with native promises sometimes needed explicit microtask flushing (`flushAll`-style helpers); that concern evaporated once Angular left the tree.

### Source changes

The same mechanical edit landed in:

`factories/algoliaSearchFactory.js`, `vectaraSearcherFactory.js`, `searchApiSearcherFactory.js`, `solrSearcherFactory.js`, `esSearcherFactory.js`, `resolverFactory.js`, and `bulkTransportFactory.js` — each drops `$q` and throws instead of calling `$q.reject()`.

### Test changes (Karma / Jasmine only — **deleted in Phase 4b**)

Karma suites picked up `MockHttpBackend` (`expectGET` / `expectPOST` / `expectJSONP` → `.respond()`) so `createFetchClient` could be exercised without `$httpBackend`:

- `test/mock/mockHttpBackend.js` — new helper; removed when Karma was deleted.
- `test/spec/transportSvc.js`, `proxyTransport.js`, `algoliaApiSearchSvc.js`, `searchApiSearchSvc.js`, `vectaraSearchSvc.js`, `settingsValidatorFactory.js` — `$httpBackend` replaced with the mock; async patterns updated.
- `test/spec/bulkTransportFactory.js` — same, plus deeper `flushMicrotasks` (10 iterations) for long fetch chains.
- `test/spec/solrSearchSvc.js` — dozens of `$httpBackend.flush()` calls removed in favor of the mock.
- `test/spec/esSearchSvc.js`, `docResolverSvc.js` — mock backend; dropped `flushAll` / `$rootScope.$apply()` where no longer needed.
- `test/spec/migrationSafetyTests.js` — HTTP-related blocks moved to `MockHttpBackend`; everything else left intact.

### Dual runner counts (post Phase 3e–f, pre–Phase 4b)

| Runner | Count (approx.) |
|--------|------------------|
| Karma (`npm test`) | ~620 tests (0 failures) — runner **removed** in Phase 4b |
| Vitest (`npm run test:vitest`) | ~70 tests in 8 files — suite **expanded** in Phase 4b |
| Integration (`npm run test:integration`) | Chunked resolver fetch OK |

---

## Phase 3 (tail) — `utilsSvc` native implementations

**Behavioral changes:** None.

Earlier in the migration, `utilsSvc` stopped calling `angular.forEach`, `angular.copy`, and `angular.merge` internally—`forEach`, `deepClone`, and `deepMerge` are native-backed now. `utilsSvc.js` no longer touches Angular APIs.

---

## Phase 4a — Strip Angular registration guards and delete `module.js`

**Behavioral changes:** Angular no longer registers `angular.module('o19s.splainer-search')`. Anyone who depended on that module existing must import ESM exports (or the IIFE globals after Phase 4b) instead.

### What changed

- Forty-eight files under `services/`, `factories/`, and `values/` lost the `if (typeof angular !== 'undefined') { angular.module(...).factory|service|value(...) }` blocks (and the “removed in Phase 4” comments).
- **`module.js` deleted** — it only declared `angular.module('o19s.splainer-search', [])`.
- `Gruntfile.cjs` — dropped `module.js` from eslint targets and concat sources.
- `package.json` — removed `module.js` from ignore/lint lists, refreshed the package description, and **removed Karma from `test:ci`** because Angular DI was gone.
- `test/integration/chunked-resolver-fetch.integration.js` — ESM harness imports `serviceFactory.js` and supplies `jsonpRequest` through `createFetchClient()` for real HTTP in Node (no jsdom).
- Karma configs — `module.js` removed from `files` / preprocessors where referenced.
- `stryker.conf.json` — `module.js` out of `mutate`; **`testRunner` → Vitest** via `@stryker-mutator/vitest-runner` (Karma’s runner needed the same Angular module as `npm test`).
- `.npmignore` — no longer lists `module.js`.
- `.eslintrc.cjs` — `angular` / `inject` globals limited to Karma/Jasmine trees; `test/integration/**/*.js` treated as ESM.

### What did NOT change

- Exported functions and library logic (aside from registration glue) stayed the same.
- The chunked resolver integration test still passed against the live HTTP fixture.

### What broke until Phase 4b

Karma/Jasmine still expected the Angular module to exist, so **`npm test` (Karma) failed** in the narrow window between Phase 4a and Phase 4b until specs moved to Vitest.

### Runner counts (post Phase 4a only — historical)

| Runner | Count |
|--------|-------|
| Vitest (`npm run test:vitest`) | Growing suite (see Phase 4b) |
| Integration (`npm run test:integration`) | Chunked resolver fetch OK |
| Karma (`npm test`) | **Failed** — no Angular module |

---

## Phase 4b — Drop Grunt/Karma; Vitest as primary; ESM package + esbuild IIFE

### Summary

Grunt concat, Karma, the Jasmine suite under `test/spec/`, and Karma helpers under `test/mock/` are gone. **`npm test` is Vitest.** The package publishes as native ESM plus esbuild-built IIFEs for script-tag loading.

### Structural changes

- **Removed:** `Gruntfile.cjs`, the three Karma configs, `scripts/karma-strip-exports.cjs`, `scripts/karma-chrome-bin.js`, all of `test/spec/`, all of `test/mock/`.
- **Added:** `build.js` (esbuild emits `dist/splainer-search.js` as `globalThis.SplainerSearch` and `dist/splainer-search-wired.js` as `globalThis.SplainerSearchWired`), `index.js` barrel, `wired.js` for the pre-wired Splainer/Quepid graph, `shims/urijs-global.js` so the IIFE can expose `globalThis.URI` from the `urijs` import.
- **`package.json`:** `"type": "module"`, `main` → `index.js`, full `exports` map (root, `wired`, both IIFE subpaths), Angular dropped from dependencies, `npm test` → `vitest run`, `test:ci` → ESLint + Vitest + integration.
- **Vitest:** Karma coverage was ported into `test/vitest/`; counts drift—use `npm test` for current totals.
- **Stryker:** stays on `@stryker-mutator/vitest-runner`.

### Behavioral / consumer impacts (semver-relevant)

- **Node / bundlers** — Default entry is ESM (`index.js`). Use named imports such as `import { createFetchClient } from 'splainer-search'`. There is no published CommonJS build, so plain `require()` will not work unless your runtime adds its own ESM bridge.
- **`<script>` tags** — Run `npm run build` (or rely on published `dist/`). `dist/splainer-search.js` attaches the barrel as `globalThis.SplainerSearch`; `dist/splainer-search-wired.js` attaches the wired API as `globalThis.SplainerSearchWired`. Load URI.js first so `globalThis.URI` exists (`shims/urijs-global.js`). Stable npm subpaths still point at both IIFEs via `exports`.
- **Splainer / Quepid-style wiring** — Prefer `import … from 'splainer-search/wired.js'` (or `'splainer-search/wired'`), matching `test/vitest/helpers/serviceFactory.js` / `wired/wiring.js`. Narrative + importmap notes: [RELEASE_NOTES_3.0.0_DRAFT.md](RELEASE_NOTES_3.0.0_DRAFT.md) → **Splainer, Quepid, importmap, and SPA wiring**; file-level map: [INTEGRATOR_SPLAINER_QUEPID.md](INTEGRATOR_SPLAINER_QUEPID.md).
- **Versus the old Grunt bundle** — Sources are real ESM (no runtime export stripping). The IIFE layout is esbuild’s namespace object, not hand-concat—double-check anything that poked at globals assuming the old shape.
- **CI** — Node-only: Vitest, jsdom where needed, plus the Node integration script (no Chrome/Karma). Run **Node ≥ 20.12** locally and in CI (`.circleci/config.yml` pins `cimg/node:22.14`; Vitest 4 / Rolldown require `util.styleText` from `node:util`).

**Search / HTTP behavior:** Phase 4b did not change engine logic—only tooling, packaging, and where tests live.

---

## Phase 4c — Remove `$sce` from the JSONP transport

### Summary

Angular’s `$sce` layer is gone from JSONP. URLs are plain strings from the factory through `httpClient.jsonp()`.

### Source / API changes

- `factories/httpJsonpTransportFactory.js` — constructor is `HttpJsonpTransportFactory(TransportFactory, httpClient)`; no `$sce`, no `trustAsResourceUrl`.
- `services/httpClient.js` — `jsonp()` stops calling `.toString()` on non-strings (that only existed for SCE-wrapped values).
- `test/vitest/helpers/serviceFactory.js` — wiring helpers no longer accept `$sce` when assembling JSONP stacks.

### Behavioral notes

- Solr/OpenSearch JSONP call sites that already passed string URLs behave the same.
- Custom code that pushed Angular “trusted resource” objects into JSONP must stringify or unwrap them first.

---

## AbortSignal / cancellable search (post–Phase 4)

**Behavioral changes:** Optional. If you never set `config.signal`, behavior matches the pre-cancellation stack.

- `services/httpClient.js` — GET/POST honor a default `options.signal` and let per-call `config.signal` win when it is not `undefined`. Native `AbortError` from `fetch` is passed through unchanged. JSONP respects `config.signal`: already-aborted signals reject immediately; otherwise an `abort` listener tears down the `<script>` and rejects with `AbortError`.
- `services/transportRequestOpts.js` — adds `transportRequestOpts(config)` (pulls `signal` for transports) and `isAbortError(err)` for shared `.catch` blocks.
- `factories/httpGetTransportFactory.js`, `httpPostTransportFactory.js`, `httpJsonpTransportFactory.js`, `httpProxyTransportFactory.js` — optional fourth `requestOpts` argument forwards `signal` into `httpClient`.
- `factories/bulkTransportFactory.js` — each queued item keeps its `signal`; the `_msearch` POST uses `AbortSignal.any` when the runtime supports it, otherwise a small composite `AbortController`.
- Searcher factories (Solr, ES, Vectara, Algolia, Search API) — `.query()` gets `transportRequestOpts(self.config)`; Elasticsearch `explain` passes `config.signal` into `httpClient.post`. When the failure is an `AbortError`, generic `searchError` / `formatError` wrappers are skipped.
- `factories/solrSearcherFactory.js` — `pager()` and `explainOther` propagate `signal` into nested searcher configs.
- `factories/esSearcherFactory.js` — `explainOther` forwards both `signal` and `proxyUrl` to the inner searcher.
- `factories/resolverFactory.js` — optional `signal` on resolver `settings` flows into `createSearcher` config.
- `index.js` — re-exports `transportRequestOpts` and `isAbortError`.

---

## Appendix — Correctness fixes shipped on `splainer-rewrite` (not only “Angular removal”)

`splainer-rewrite` also carries plain bug fixes compared to older tagged releases—see the branch history (for example `0803b0c`, `b1ea256`, `10ad14b`, `eb2e09d`, `d3adade`, `7446e52`). Expect differences in field highlighting, timed query arrays, `explainOther` timing and side effects, empty Elasticsearch responses, bulk transport timers, JSON header parsing, URL encoding, and JSONP basic-auth URLs (userinfo now splits on the **first** `:` only, so passwords may contain `:`). None of that requires Angular to be involved: upgrading for 3.x can still change snapshots, explain trees, or resolver output, so re-check those areas alongside the packaging work.

The item-by-item checklist for QA lives in [RELEASE_NOTES_3.0.0_DRAFT.md](RELEASE_NOTES_3.0.0_DRAFT.md) under **Correctness fixes (independent of Angular removal)**. This appendix stays thematic; the hashes above are breadcrumbs into git when you need provenance.

---

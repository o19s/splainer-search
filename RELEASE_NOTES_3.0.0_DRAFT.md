# 3.0.0 (DRAFT) — Angular removal & ESM rewrite

This is a **semver-major** release. AngularJS is fully removed. The package is native ES modules for `import`; IIFE bundles under `dist/` remain if you load the library with a `<script>` tag.

The long-form migration log—phases, file-level tables, and a short appendix that points at correctness themes and commits—is [MIGRATION_CHANGES.md](MIGRATION_CHANGES.md). **This draft** is the upgrade guide: what breaks, how to adapt, and the full **Correctness fixes** checklist so you can see what might change in behavior without reading the whole migration story.

## Highlights

- Angular is gone: no `angular`, `$http`, `$q`, `$timeout`, `$log`, `$sce`, or `angular.module('o19s.splainer-search')`.
- Regular HTTP uses the Fetch API through `createFetchClient()`. JSONP still loads with a dynamic `<script>` tag where that path applies.
- Promises are plain `Promise`; there are no Angular digest cycles tied to async work.
- Tests are Vitest-only—Karma, Grunt, the old Jasmine specs, and the export-stripping preprocessor are removed. `npm test` runs Vitest; `npm run test:ci` adds ESLint and `npm run test:integration` (chunked resolver fetch). More release checks are in **Validation** below.
- For a Quepid- or Splainer-style service graph in one place, import from `splainer-search/wired.js` or `splainer-search/wired`—you get `createWiredServices`, `createSearcher`, `createFieldSpec`, `createNormalDoc`, and the lazy `wired` namespace (same wiring as `test/vitest/helpers/serviceFactory.js` / `wired/wiring.js`). Import from the package root when you wire constructors yourself.
- `npm run build` (esbuild) writes `dist/splainer-search.js` as `globalThis.SplainerSearch` (barrel re-exported from `index.js`) and `dist/splainer-search-wired.js` as `globalThis.SplainerSearchWired`, matching the ESM wired entry.
- You can cancel in-flight GET/POST by passing `signal` on the searcher `config`, on individual `get`/`post` calls, or as defaults on `createFetchClient`. JSONP respects `signal` by tearing down the script and rejecting with `AbortError`. Bulk `_msearch` combines batched signals when `AbortSignal.any` exists (details under **Environment / `AbortSignal.any`** below). Exports `isAbortError` and `transportRequestOpts` help shared `.catch` blocks treat cancellation separately from HTTP or search errors.

## Breaking changes

### Packaging / consumption

- **Breaking:** `package.json` `main` used to point at a root-level concat IIFE (`splainer-search.js`). It now points at `index.js`, which is ESM.
- **Breaking:** The package declares `exports`: the root resolves to `index.js`; `splainer-search/wired` and `splainer-search/wired.js` resolve to `wired.js`; `splainer-search/splainer-search.js` and `splainer-search/splainer-search-wired.js` resolve to the built IIFEs under `dist/`; `package.json` is exposed for tooling that asks for it.
- **Breaking:** `"type": "module"` — we do not ship a CommonJS build. `require('splainer-search')` will not work on older Node; prefer `import`, or Node **22.12+** with `require(esm)` if that matches how your app loads dependencies.
- **Breaking:** AngularJS is no longer a peer. Nothing registers `angular.module('o19s.splainer-search')`.
- **Breaking:** Script-tag users no longer get an Angular module. After `npm run build`, `dist/splainer-search.js` attaches `globalThis.SplainerSearch` (constructors / barrel surface); `dist/splainer-search-wired.js` attaches `globalThis.SplainerSearchWired` for the pre-wired graph.
- **Breaking:** URI.js is not pulled in implicitly the way it was under the old Angular graph. Load URI first so `globalThis.URI` exists before the IIFE runs (see `shims/urijs-global.js`).
- **Breaking:** There is no longer a published `splainer-search.min.js`. Use `dist/splainer-search.js`, the `splainer-search/splainer-search.js` subpath, or run your own minifier in the app build.
- Node **>=18** is declared in `engines`.

### Consumer migration

- If you used `angular.module('o19s.splainer-search')`, that entry point is gone. For the same pre-wired service graph Splainer- and Quepid-style apps expect, import from `splainer-search/wired.js` (e.g. `createWiredServices`, `createSearcher`). Otherwise import named exports from `splainer-search`—`SolrSearcherFactory`, `EsSearcherFactory`, `DocFactory`, `createFetchClient`, `defaultSolrConfig`, and others—and wire them yourself, or load the built IIFE and use `globalThis.SplainerSearch`.
- With `<script>` tags: load URI.js first, then either `dist/splainer-search.js` from a local build or `node_modules/splainer-search/dist/splainer-search.js` from npm. Use `window.SplainerSearch.<exportName>` instead of Angular service lookup. For the wired graph in one file, use `dist/splainer-search-wired.js` and `globalThis.SplainerSearchWired`.
- **Breaking:** JSONP URLs must be plain strings. Angular `$sce` “trusted resource” objects are not accepted anymore.
- For cookies on cross-origin GET/POST, pass `credentials: 'include'` (or your policy) into `createFetchClient`, or wrap the `fetch` you inject there if you need CSRF headers, tracing, and so on. JSONP does not go through `fetch`, so credential behavior there is unchanged.
- **Breaking:** There is no Angular `$http` interceptor or transform pipeline. If you relied on that globally, wrap the `fetch` passed into `createFetchClient` instead.
- **Breaking:** There is no default export—`import splainer from 'splainer-search'` will fail. Use named imports, e.g. `import { SolrSearcherFactory } from 'splainer-search'`.
- **Breaking:** We removed the old `String.prototype.hasSubstr` polyfill (`services/stringPatch.js`). Nothing in this repo still needs it; if outside code accidentally depended on that side effect, switch callers to `String.prototype.includes` (or polyfill in your own app).
- IIFE builds target ES2020 (esbuild). Expect current Edge, Chrome, Firefox, and Safari—not IE11 or very old Safari. Source maps sit next to the bundles under `dist/` for easier debugging.

### Splainer, Quepid, importmap, and SPA wiring

These notes are aimed at [Splainer](https://github.com/o19s/splainer), [Quepid](https://github.com/o19s/quepid), and any app that wires the library the same way.

- If you ship one file via import map or a plain `<script>` tag and you want `createWiredServices`, `createSearcher`, `createFieldSpec`, `createNormalDoc`, and the same graph our tests use (`test/vitest/helpers/serviceFactory.js`), prefer `dist/splainer-search-wired.js` / `globalThis.SplainerSearchWired`, or ESM `splainer-search/wired.js`. The barrel file `dist/splainer-search.js` / `globalThis.SplainerSearch` only exposes constructors—you still have to connect dependencies yourself.
- Do your wiring in a single bootstrap module: e.g. create the fetch client, call `createWiredServices`, export your app API. Do not vendor a copy of `wired/wiring.js` into your repo; if you need CSRF, tracing, or test doubles, wrap the `fetch` you pass in instead of forking the graph.
- Avoid maintaining a second private esbuild (or similar) of this package next to the published one—constructor order will drift from what `npm test` actually covers.
- Wire cancellation end to end: the same `AbortController` or `AbortSignal` the UI uses to drop work should reach `createSearcher` as `config.signal` (see **Highlights** and **Environment / `AbortSignal.any`**). In Quepid that usually means one controller drives both `fetchTryConfig` (or your try-fetch equivalent) and the searcher `config.signal`.
- After upgrading, re-check proxy paths, basic auth, custom headers, snapshot compare, and explain. Keep Splainer 2, Quepid, and sibling apps on a splainer-search version they support and on one wired integration style each. Legacy Splainer (Angular) can stay on 2.x until that line is migrated.
- Lazy-loaded explain can touch code paths that parse a bit more than “strict JSON only” would suggest—expect small snapshot or explain diffs versus older assumptions; still eyeball the explain UI after a bump.

### Promise rejection contract

**Breaking:** In several places the old code caught a failure and `return`ed the error-shaped object from `.catch`, which turned a real failure into a *successful* promise whose value looked like an error. Callers were expected to branch inside `.then` on `resp.error`. In 3.0.0 those paths **reject** the promise instead, which matches normal `async`/`Promise` usage but breaks handlers that only inspect `resp.error` inside `.then`.

That affects `EsSearcherFactory.explain`, `explainOther`, and `renderTemplate`, `SolrSearcherFactory.explainOther`, and `resolverFactory.fetchDocs` (chunked and non-chunked).

If you still do this, failures will skip the `.then` body and often surface as unhandled rejections:

```js
searcher.explain().then(resp => {
  if (resp.error) { /* handle failure */ } else { /* use resp */ }
});
```

Prefer `.catch` on the promise, or `try` / `await` / `catch`:

```js
try {
  const resp = await searcher.explain();
  // use resp
} catch (err) {
  // handle failure
}
```

This is deliberate (turning fake successes into real rejections is the right Promise shape), but it touches a lot of search-related promises—audit any custom code that treated “resolved with an error field” as the error path.

### `customHeaders` JSON parsing

**Breaking:** In 2.x, bad `customHeaders` JSON (in `searchSvc`, `esUrlSvc`, or `vectaraUrlSvc`) blew up the search with a `SyntaxError`. In 3.0.0, `customHeadersJson.tryParseObject` logs a `console.warn`, drops the bad value, and sends the request with no custom headers instead of throwing. If auth suddenly starts failing after upgrade, open devtools and look for `splainer-search: invalid customHeaders JSON`.

### Response shape (unchanged on purpose)

`createFetchClient` still resolves successful responses as `{ data, status, statusText }`, like Angular’s `$http`. JSON responses are parsed into `data`. Failed HTTP status codes reject with that same object shape. Non-string POST bodies are sent as `JSON.stringify(body)`.

### Environment / `AbortSignal.any`

Bulk `_msearch` batches several in-flight requests; when the runtime implements `AbortSignal.any`, we use it to combine their signals (Safari 16.4+, Chromium 113+, Firefox 124+, Node 20+, and other current engines). If `AbortSignal.any` is missing, we attach a small composite `AbortController` that forwards abort from any batched signal—cancellation still works, with a bit more glue code.

In shared `.catch` blocks, use `isAbortError(err)` (and `transportRequestOpts(config)` if you need the same defaults the transports use) from `splainer-search` or `splainer-search/wired.js` so user cancellation does not look like an ordinary HTTP or search error.

## Correctness fixes (independent of Angular removal)

The `splainer-rewrite` work also landed a pile of behavior fixes that ship in 3.0.0. You may see different highlights, explain trees, URLs, or field text even if you did not change how you call the library—worth re-running your fixtures and manual checks. **Splainer** and **Quepid** are the usual places this shows up first (explain UI, snapshot compare, weird Solr/Elasticsearch queries).

Quick themes to re-check: field highlighting, `explainOther` side effects and when its promise settles, empty Elasticsearch results, bulk transport and timers, timed-query array handling, JSON header parsing (`tryParseObject`), URL encoding, and JSONP basic auth when the password contains `:` (commit `82ba5bf`).

- **Algolia:** `retrieveObjects` (`/1/indexes/*/objects`) now sets `numFound = results.length` and `nbPages = 1`. On 2.x both were `undefined` because that response omits `nbHits` / `nbPages`.
- **Elasticsearch GET:** The `q=` segment is now passed through `encodeURIComponent`. On 2.x it was concatenated raw, so `&`, `=`, `+`, `#`, spaces, or non-ASCII could corrupt the URL. Expect snapshot and HTTP-capture diffs for non-trivial queries. **If you pre-encoded `searcher.queryText` before passing it in, stop—you will double-encode now.**
- **Explain labels:** `WeightExplain`’s regex now captures the inner text, so `weight(...)` wrappers actually strip from labels. On main the pattern had no real capture, so `match[1]` was always `undefined`. Labels shorten; golden tests may move.
- **Explain typos / guards:** `MinExplain.realExplaination` is renamed to `realExplanation` (the old name never matched anything). `MinExplain`, `DismaxExplain`, and `DismaxTieExplain` `vectorize()` no longer throw on empty children—they use `vectorSvc.create()` instead of indexing `infl[0]`. The `weight(FunctionScoreQuery(...))` branch in `explainSvc` sets the prototype before `new`, so influencers and `vectorize` behave on that node.
- **Field specs:** `unabridged` parsing reads the real `unabridgeds` list (main looked for `unabridged`, so `unabridged:body_content` was ignored). `transformFieldSpec(undefined)` no longer crashes in `.trim()`; main only tolerated `null`.
- **Doc display:** `normalDocsSvc` maps `null`/`undefined` to empty string instead of the literal strings `'null'`/`'undefined'`—UI titles for missing fields change. `esDocFactory.origin()` deep-clones fields so mutating the returned object does not corrupt the stored doc. `vectaraDocFactory.fieldsProperty()` treats missing `metadata` as `[]` instead of throwing.
- **Solr URL encoding:** The “already percent-encoded” detector was wrong for `%6x`–`%Fx`; strings with those escapes may encode differently now.
- **Solr searchers:** `pageConfig` is deep-cloned from `defaultSolrConfig` so two searchers no longer share one mutable pagination template. `explainOther` restores `self.args.explainOther` after a failed call instead of leaving it stuck.
- **Bulk transport:** `enqueue` restarts the timer chain when a batch finishes, and changing URLs cancels the previous `BatchSender` instead of leaking timers.

For themes, commit hashes, and migration-appendix context, see [MIGRATION_CHANGES.md](MIGRATION_CHANGES.md) (Appendix: `0803b0c`, `b1ea256`, `10ad14b`, `eb2e09d`, `d3adade`, `7446e52`).

## Subtle non-breaking differences

- `utilsSvc.deepClone` prefers `structuredClone` and falls back to a JSON round-trip. That fallback drops function-valued properties and `undefined` keys—closer to `angular.copy` for plain data, but not identical if your app ever cloned objects that carried functions. We do not rely on cloning functions internally.
- Bulk batching still waits ~100 ms before flushing; the timer is ordinary `setTimeout` / `clearTimeout` instead of an Angular digest tick.
- Debug and error output go through `console.debug` and `console.error` instead of Angular’s `$log`.

## Validation

- `npm run test:ci` runs ESLint, Vitest, and the chunked resolver integration script. Test counts drift—do not trust numbers copied from old docs; run `npm test` locally when you need the current Vitest total.
- `npm run pack:check` runs a production build, then `npm pack --dry-run`, so you can see that `dist/splainer-search.js`, `dist/splainer-search-wired.js`, and their `.map` files would actually ship. That catches a bad `files` list or publishing with scripts skipped.
- Quick IIFE sanity check: run `node build.js`, load URI.js, then load `dist/splainer-search.js` in a browser or harness—you should get `globalThis.SplainerSearch` with exports such as `createFetchClient`, `SolrSearcherFactory`, `EsSearcherFactory`, `DocFactory`, and `defaultSolrConfig`.

## Pointers

- [MIGRATION_CHANGES.md](MIGRATION_CHANGES.md) — phase-by-phase log, historical branch notes at the top, and the **3.0 integrator checklist** (it links back here for the promise contract and **Validation**).
- [INTEGRATOR_SPLAINER_QUEPID.md](INTEGRATOR_SPLAINER_QUEPID.md) — which Splainer / Quepid files touch which APIs.
- [FUTURE.md](FUTURE.md) — planned direction (e.g. CORS / JSONP deprecation).

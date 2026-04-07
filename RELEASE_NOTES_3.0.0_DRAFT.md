# 3.0.0 (DRAFT) — Angular removal & ESM rewrite

This is a **semver-major** release. AngularJS has been removed entirely and the
library is now distributed as native ES modules with a separate IIFE bundle for
`<script>`-tag consumers.

Source of truth for everything below: `MIGRATION_CHANGES.md` (Phases 1–4c) and
the Appendix of correctness fixes shipped on `splainer-rewrite`.

## Highlights

- **No AngularJS dependency.** `angular`, `$http`, `$q`, `$timeout`, `$log`,
  `$sce`, and `angular.module('o19s.splainer-search')` registration are gone.
- **Native HTTP via `fetch`.** All transports route through
  `createFetchClient()` (GET/POST = `fetch`, JSONP = dynamic `<script>` tag).
- **Native `Promise`.** `$q.defer` / `$q()` / `$q.reject` replaced with
  `new Promise` / `throw`. No digest cycles.
- **Vitest + ESM tests.** Karma, Grunt, Jasmine specs, and the export-stripping
  preprocessor are gone. `npm test` runs Vitest (548 tests, 41 files);
  `npm run test:ci` adds ESLint and the chunked-resolver integration script.
- **esbuild IIFE bundle.** `npm run build` produces `splainer-search.js`
  (`globalThis.SplainerSearch`, 48 named exports).

## Breaking changes

### Packaging / consumption

| Topic | Before (2.36.x) | After (3.0.0) |
|---|---|---|
| `package.json` `main` | `splainer-search.js` (concat IIFE) | `index.js` (**ESM**) |
| `exports` | none | `"."` → `index.js`, `"./splainer-search.js"` → IIFE |
| Module type | CommonJS-compatible | `"type": "module"` — **no CJS build shipped**; `require('splainer-search')` is unsupported |
| AngularJS | Required peer; registered services on `o19s.splainer-search` | **Removed**. No `angular.module(...)` registration anywhere |
| Browser global (IIFE) | Angular module registration | **`globalThis.SplainerSearch`** namespace object |
| URI.js | Bundled via Angular dep graph | **Must be loaded first** so `globalThis.URI` exists before the IIFE (see `shims/urijs-global.js`) |
| Node engines | unspecified | `>=18` |

### Consumer migration

- **Angular apps**: `angular.module('o19s.splainer-search')` no longer exists.
  Import the named ESM exports (`SolrSearcherFactory`, `EsSearcherFactory`,
  `DocFactory`, `createFetchClient`, `defaultSolrConfig`, …) from
  `splainer-search` and wire them into your DI container yourself, or load the
  IIFE and read off `globalThis.SplainerSearch`.
- **`<script>` consumers**: load `urijs` first, then `splainer-search.js`. Use
  `window.SplainerSearch.<Name>` instead of any prior global / Angular service
  lookup.
- **JSONP integrators**: pass **plain string URLs**. Angular `$sce` trusted
  URL objects are no longer accepted (Phase 4c).
- **Cookies on cross-origin requests**: `fetch` defaults to *credentials
  omitted*. If you previously relied on Angular/XHR same-site cookie defaults,
  wrap `createFetchClient` with a `fetch` that sets `credentials: 'include'`.
- **`$http` interceptors / transforms**: not replicated. There is no global
  request/response pipeline — wrap `createFetchClient`'s injected `fetch` if
  you need one.
- **No default export.** `import splainer from 'splainer-search'` will not
  work; use named imports (`import { SolrSearcherFactory } from 'splainer-search'`).
- **`String.prototype.hasSubstr` polyfill removed.** Main shipped a
  `services/stringPatch.js` polyfill that monkey-patched `String.prototype`.
  No source still calls it. Third-party code that *incidentally* relied on the
  polyfill being installed as a side effect of importing splainer-search will
  no longer get it — use `String.prototype.includes` directly.
- **Browser baseline: ES2020.** The IIFE bundle is built with esbuild
  `target: ['es2020']`, which means modern Edge/Chrome/Firefox/Safari only —
  no IE11, no pre-2020 Safari. Source maps are now emitted alongside the bundle
  to make debugging the IIFE feasible.

### Promise rejection contract

Several `.catch` blocks across the searcher factories and `resolverFactory`
used to do `return response`, which silently converted a rejection into a
*resolution* whose value was the error payload. Downstream `.then()` handlers
had to inspect the value and figure out whether it represented success or
failure. **In 3.0.0, these rejections are real rejections.**

Affected code paths include `EsSearcherFactory.explain` /
`explainOther` / `renderTemplate`, `SolrSearcherFactory.explainOther`, and
`resolverFactory.fetchDocs` (both chunked and non-chunked paths).

If your code looked like:

```js
searcher.explain().then(resp => {
  if (resp.error) { /* handle failure */ } else { /* use resp */ }
});
```

…it will now silently miss the failure case (the `.then` handler is never
called and you'll see an unhandled rejection instead). Wrap calls in `.catch`
or use `try`/`catch` with `await`:

```js
try {
  const resp = await searcher.explain();
  // use resp
} catch (err) {
  // handle failure
}
```

This is a correctness fix — silently swallowing rejections is a Promise
anti-pattern — but it changes the contract of every search Promise in the
library, so audit any custom error-handling that reads error fields off the
resolved value.

### `customHeaders` JSON parsing

In 2.x, passing invalid JSON for `customHeaders` (in `searchSvc`, `esUrlSvc`,
or `vectaraUrlSvc`) threw a `SyntaxError` from inside the search call. In
3.0.0, invalid JSON logs a `console.warn` via `customHeadersJson.tryParseObject`
and falls back to an empty header map, so the request still goes out — just
without the bad headers. Watch your devtools console for
`splainer-search: invalid customHeaders JSON` if you suddenly see 401s after
upgrading.

### Response shape (unchanged on purpose)

`createFetchClient` resolves with `{ data, status, statusText }` to match
Angular `$http`. JSON bodies are parsed; 4xx/5xx reject with the same shape.
POST bodies that are non-string are `JSON.stringify`'d.

## Correctness fixes (independent of Angular removal)

The `splainer-rewrite` branch also contains behavior-changing bug fixes that
ship in 3.0.0. Re-validate the following areas against your fixtures:

- Field / highlight handling
- `explainOther` side effects and promise completion
- Empty Elasticsearch result edge cases
- Bulk transport and timer lifecycle
- Timed query array mutation
- Safer JSON header parsing (`tryParseObject`)
- URL encoding edges
- Basic auth when the password contains `:` (commit `82ba5bf`)
- Algolia `retrieveObjects` (`/1/indexes/*/objects` endpoint) now sets `numFound = results.length` and `nbPages = 1`. On 2.x both fields were `undefined` because the endpoint doesn't return `nbHits`/`nbPages`.
- Elasticsearch GET requests now `encodeURIComponent` the `q=` query text. On 2.x the query was concatenated raw, so any query containing `&`, `=`, `+`, `#`, spaces, or non-ASCII produced a malformed URL. URL-level snapshots and HTTP captures will diff for non-trivial queries. **If your code pre-encodes `searcher.queryText` before passing it in, stop — you'll now get double-encoding.**
- `WeightExplain` regex now has a capture group, so `weight(...)` wrappers actually get stripped from explain labels. Main's regex was `/^weight\((?!FunctionScoreQuery).*/` (no parens), so `match[1]` was always `undefined`. **Explain UI labels will visibly shorten — golden-master tests will diff.**
- `MinExplain.realExplaination` typo → `realExplanation`. The previous name silently never matched anywhere; the rename makes it actually fire.
- `MinExplain` / `DismaxExplain` / `DismaxTieExplain` `vectorize()` now guards empty children with `vectorSvc.create()` instead of throwing on `infl[0]`.
- `explainSvc` `weight(FunctionScoreQuery(...))` branch now sets the prototype before instantiation, so influencers/vectorize on that node work for the first time.
- `fieldSpecSvc` `unabridged` parsing now uses the correct `unabridgeds` key (main checked `unabridged`, which never matched the actual list — `unabridged:body_content` declarations on main were silently ignored).
- `fieldSpecSvc.transformFieldSpec(undefined)` no longer throws. Main required `=== null` and crashed inside `.trim()` for `undefined`.
- `normalDocsSvc` `assignSingleField` and `assignSubs.parseValue` now coerce `null`/`undefined` to `''` instead of the literal strings `'null'`/`'undefined'`. **UI titles for nullish source fields will change.**
- `solrUrlSvc` percent-encoding regex fixed (main's `/\%(?!(2|3|4|5))/g` only treated `%2x..%5x` as already-encoded; new regex handles all `%XX` hex pairs). Strings containing `%6x..%Fx` will encode differently.
- `solrSearcherFactory.pageConfig` is now deep-cloned from `defaultSolrConfig`. Main mutated the shared default constant — multiple searchers on the same page could pollute each other's pagination defaults.
- `solrSearcherFactory.explainOther` now restores `self.args.explainOther` on failure instead of leaving it permanently mutated.
- `esDocFactory.origin()` deep-clones each field. Main returned live references — callers that mutated the returned object accidentally mutated the underlying doc.
- `vectaraDocFactory.fieldsProperty()` guards missing `metadata` with `|| []`; main threw.
- `bulkTransportFactory` `enqueue` correctly restarts the recursive timer chain after it ends, and switching URLs now cancels the prior `BatchSender` (main leaked the timer).

See `MIGRATION_CHANGES.md` Appendix and the commits referenced there
(`0803b0c`, `b1ea256`, `10ad14b`, `eb2e09d`, `d3adade`, `7446e52`) for context.

## Subtle non-breaking differences

- `utilsSvc.deepClone` uses `structuredClone` with a JSON-roundtrip fallback.
  The fallback **drops function-valued properties and `undefined` values**.
  No internal call site clones functions; flagged for downstream callers that
  used to lean on `angular.copy` semantics.
- BulkTransport batching still uses a 100 ms timer, now via `setTimeout` /
  `clearTimeout` (no digest tick).
- Logging uses `console.debug` / `console.error` directly (was `$log.*`).

## Validation

- `npm run test:ci` — ESLint + Vitest (548 passed, 2 skipped) + integration.
- IIFE smoke test — `node build.js` → load `urijs` then `splainer-search.js`;
  `globalThis.SplainerSearch` exposes 48 named exports including
  `createFetchClient`, `SolrSearcherFactory`, `EsSearcherFactory`, `DocFactory`,
  `defaultSolrConfig`.

## Pointers

- Phase-by-phase change log: `MIGRATION_CHANGES.md`
- Migration plan / sign-off checklist: `MIGRATION_PREP.md`
- Future direction (CORS / JSONP deprecation): `FUTURE.md`

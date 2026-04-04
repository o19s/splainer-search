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
- **No test logic changed.** All 619 Karma tests and the integration test pass
  without modification.

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

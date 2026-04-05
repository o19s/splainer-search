# Angular Removal: Migration Plan

**Date:** 2026-04-03 (started); HTTP/`$q` track complete on branch — **Phase 3 tail + Phase 4** remain  
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
4. [HTTP and $q migration (historical)](#4-http-and-q-migration-historical)
5. [Modernize the Build Pipeline](#5-modernize-the-build-pipeline)
6. [Remaining Migration Order](#6-remaining-migration-order)
7. [Validation Strategy](#7-validation-strategy)

---

## 1. Progress log

**Do not maintain a second copy of finished phases here.** Shipped work (through the HTTP / `$q` migration track) lives in **`MIGRATION_CHANGES.md`**.

This file is **what is left**: utils internals, optional cleanups, and Phase 4. After each chunk of work, update the change log first, then [§6](#6-remaining-migration-order). Background on the HTTP/`$q` migration lives in [§4](#4-http-and-q-migration-historical).

### Angular-related surface still in sources (snapshot)

| API | Where | Notes |
|-----|-------|--------|
| `angular.forEach` / `angular.copy` / `angular.merge` | `utilsSvc.js` only | **Done** — native implementations (`Array.forEach`, `structuredClone`, custom `deepMerge`) |
| `angular.module()` … | All 47 source files (guarded) | Removed in Phase 4 |
| `$sce` | `httpJsonpTransportFactory` | Optional later removal once JSONP path is fully non-Angular — see **`FUTURE.md`** |

#### Deep clone contract (`utilsSvc`)

Call sites use **plain data** (configs, Solr/ES shapes). `utilsSvc.deepClone` now uses `structuredClone` with a JSON-roundtrip fallback for objects containing functions (e.g. fieldSpec objects with methods). The JSON fallback **drops function-valued properties and undefined values** — this differs from `angular.copy`, which preserved both. No call site depends on cloning functions. The Vitest stub in `test/vitest/helpers/utilsSvcStub.js` mirrors the production implementation.

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

## 4. HTTP and $q migration (historical)

### Why order mattered

Originally, `$http` and `$q` shared one digest-driven promise world: `$httpBackend.flush()` and `$rootScope.$apply()` could flush work **synchronously**. Dropping a native `Promise` into the middle broke specs that asserted right after `flush()`, because `$q` treats thenables as async. The migration therefore replaced HTTP first, then removed `$q` patterns from the chain. That work is **complete** on this branch; see **`MIGRATION_CHANGES.md`** (Phases 3a–3d and related entries), including test helpers such as `flushAll` where microtasks and digests interleave.

### Planned steps 1–5 (complete)

The bottom-up plan (transport `httpClient` / `createFetchClient`, direct POST callers, native `Promise` instead of `$q.defer` / `$q()` wrappers, `throw` instead of `$q.reject`, removal of `$q` from signatures) is **done** on this branch. File-by-file notes, tests, and timing caveats are in **`MIGRATION_CHANGES.md`** (Phases 3a–3d and related entries).

### `$sce` (JSONP)

`httpJsonpTransportFactory` may still use `$sce.trustAsResourceUrl` when an SCE-aware caller is present. `createFetchClient` JSONP uses dynamic `<script>` tags. Longer-term transport defaults / CORS: **`FUTURE.md`**.

### Test notes (fetch / microtasks)

- **Vitest:** `vi.stubGlobal('fetch', mockFn)` for `createFetchClient` tests
- **Karma:** `createFetchClient({ fetch: spy })` via `$provide.factory('httpClient', …)` where needed; some suites use `MockHttpBackend` or similar (see change log)
- Where native `Promise` and Angular digests interleave, specs may use a small `flushAll` loop (`Promise.resolve` + `$rootScope.$apply()`)

---

## 5. Modernize the Build Pipeline

**Current:** Grunt → ESLint → Karma → concat (with export stripping) → `splainer-search.js`; Prettier; Karma coverage with `strip-exports` preprocessor; Vitest alongside.

**Target:** esbuild bundle; Vitest as primary runner; drop Karma + Grunt.

- [ ] Optional `esbuild` script alongside Grunt during transition

---

## 6. Remaining Migration Order

### Phase 3 (tail)

HTTP / `$q` / `$log` / `$timeout` work is **complete** on this branch — see **`MIGRATION_CHANGES.md`**. Open items:

- [ ] Swap `utilsSvc` internals from `angular.*` to native implementations
- [ ] Optional: drop `$sce` from the JSONP factory when JSONP is fully non-Angular (see **`FUTURE.md`**)

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

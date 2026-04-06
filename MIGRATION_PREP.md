# Angular Removal: Migration Plan

**Date:** 2026-04-03 (started)  
**Current branch:** `splainer-rewrite` (based on `main` @ v2.36.4)  
**Target:** Remove AngularJS entirely, convert to vanilla JS ES modules — **nearly complete**, only final sign-off remains.

**Ground truth:** This document, **this** branch’s green tests, and the [public API](#public-api--semver) below. Do **not** use branch `vanilla-simplify` for validation, diffs, copying code/tests, or sign-off — it was an earlier full-stack experiment (ES modules, fetch, Vitest, Playwright). Mention it only as historical context.

**Change log:** See `MIGRATION_CHANGES.md` for a record of what changed and what didn’t in each phase.

### Public API & semver

`package.json` `main` → root `splainer-search.js`, built by esbuild (`services/`, `factories/`, `values/`). Keep response shapes, module/globals, and behavior stable unless you ship a **semver-major** release with documented breaks. After ESM, set `main` / `exports` explicitly.

---

## Table of Contents

1. [Progress log](#1-progress-log)
2. [Test Runners](#2-test-runners)
3. [Coverage Baseline](#3-coverage-baseline)
4. [HTTP and $q migration (historical)](#4-http-and-q-migration-historical)
5. [Build Pipeline](#5-build-pipeline)
6. [Remaining Migration Order](#6-remaining-migration-order)
7. [Validation Strategy](#7-validation-strategy)

---

## 1. Progress log

Shipped work lives in **`MIGRATION_CHANGES.md`**. All Angular API surface has been removed from sources.

#### Deep clone contract (`utilsSvc`)

Call sites use **plain data** (configs, Solr/ES shapes). `utilsSvc.deepClone` now uses `structuredClone` with a JSON-roundtrip fallback for objects containing functions (e.g. fieldSpec objects with methods). The JSON fallback **drops function-valued properties and undefined values** — this differs from `angular.copy`, which preserved both. No call site depends on cloning functions. The Vitest stub in `test/vitest/helpers/utilsSvcStub.js` mirrors the production implementation.

---

## 2. Test Runners

**Vitest** (primary): `npm test` — 547 tests across 41 spec files in `test/vitest/`. Imports ES modules directly. Uses `test/vitest/helpers/utilsSvcStub.js` where `utilsSvc` is required.

**Integration**: `npm run test:integration` — Node.js + jsdom, real HTTP server.

**CI**: `npm run test:ci` = ESLint + Vitest + integration.

---

## 3. Coverage Baseline

**Post-Phase 2** (2026-04-04), Karma + ChromeHeadless (historical — Karma has since been removed):

| Metric | Coverage | Count |
|--------|----------|-------|
| Statements | **95.72%** | 2309 / 2412 |
| Branches | **84.56%** | 871 / 1030 |
| Functions | **95.39%** | 456 / 478 |
| Lines | **95.75%** | 2299 / 2401 |

Branch dip from original 88.00% was from `if (typeof angular !== ‘undefined’)` guards (47 files × 1 uncovered `false` branch). These guards have been deleted.

---

## 4. HTTP and $q migration (historical)

### Why order mattered

Originally, `$http` and `$q` shared one digest-driven promise world: `$httpBackend.flush()` and `$rootScope.$apply()` could flush work **synchronously**. Dropping a native `Promise` into the middle broke specs that asserted right after `flush()`, because `$q` treats thenables as async. The migration therefore replaced HTTP first, then removed `$q` patterns from the chain. That work is **complete** on this branch; see **`MIGRATION_CHANGES.md`** (Phases 3a–3d and related entries), including test helpers such as `flushAll` where microtasks and digests interleave.

### Planned steps 1–5 (complete)

The bottom-up plan (transport `httpClient` / `createFetchClient`, direct POST callers, native `Promise` instead of `$q.defer` / `$q()` wrappers, `throw` instead of `$q.reject`, removal of `$q` from signatures) is **done** on this branch. File-by-file notes, tests, and timing caveats are in **`MIGRATION_CHANGES.md`** (Phases 3a–3d and related entries).

### `$sce` (JSONP)

`$sce` has been fully removed. JSONP now uses dynamic `<script>` tag injection via `createFetchClient` with no Angular dependency. Longer-term transport defaults / CORS: **`FUTURE.md`**.

### Test notes (fetch)

- **Vitest:** `vi.stubGlobal('fetch', mockFn)` or `createFetchClient({ fetch: spy })` for HTTP tests

---

## 5. Build Pipeline

esbuild bundle (`node build.js`) → `splainer-search.js`; ESLint; Prettier; Vitest.

---

## 6. Remaining Migration Order

Phases 1–3 and Phase 4 implementation are **complete** — see **`MIGRATION_CHANGES.md`**.

### Remaining

- [ ] Sign off on **this** branch’s tests and [public API](#public-api--semver)

---

## 7. Validation Strategy

- **CI gate:** `npm run test:ci` (ESLint + Vitest + integration)
- **Sign-off:** Full suite; Solr/ES smoke if possible; **public API / semver** — [Public API & semver](#public-api--semver)
- **Change log:** Update `MIGRATION_CHANGES.md` after each phase

# Code Review: splainer-search

**Date:** 2026-04-03  
**Branch reviewed:** `splainer-rewrite`  
**Compared against:** `main`  


---

## Design follow-up

### `services/httpClient.js` — Credentials / fetch options

No first-class equivalent to Angular’s `$httpProvider.defaults.withCredentials` (or broader `credentials` / `mode` / `cache` control). Quepid and similar apps rely on cookies for some Solr setups.

**Worth doing:** Yes, as a **separate** design (API shape, defaults, Quepid audit), not as a drive-by patch.

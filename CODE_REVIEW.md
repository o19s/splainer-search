# Code Review: splainer-search

**Date:** 2026-04-03  
**Branch reviewed:** `splainer-rewrite`  
**Compared against:** `main`  
**Result:** All issues exist on **both** branches unless noted otherwise.

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 0     |
| Medium   | 6     |
| Low      | 11    |

**Importance** on each item (High / Medium / Low) is a pragmatic scheduling lens: how strongly we’d prioritize a fix in normal planning. It is not the same as **Severity** (how bad it is when it happens); the two can diverge—for example, a rare edge case can be medium severity but low importance.

---

## Medium Severity

### 14. `resolverFactory.js:32-39` — `escapeIds` is a no-op **— Importance: High**

**Branch:** both

```js
// SUSS_USE_OF_ESCAPING
ids.push(id);  // no escaping applied
```

The actual escaping call is commented out. Solr IDs with special characters (colons, parens, spaces) will produce malformed Lucene queries.

**Fix:** Re-enable escaping or document why it was intentionally disabled.

---

### 15. `baseExplainSvc.js:95-111` — `toStr()` memoization ignores `depth` parameter **— Importance: Medium**

**Branch:** both

```js
var asStr = '';
this.toStr = function(depth) {
    if (asStr === '') {
        // compute with current depth, cache forever
        asStr = me + childStrs.join('\n');
    }
    return asStr;
};
```

First call's depth is cached. Subsequent calls with different depths return wrong indentation.

**Fix:** Include depth in the cache key, or remove memoization.

---

### 16. `normalDocsSvc.js` — Missing fields coerced to string `"undefined"` **— Importance: High**

**Branch:** both

When a nested field path resolves to `undefined`, the code produces the literal string `"undefined"` via `'' + undefined`. Users see "undefined" as document titles or field values.

**Fix:** Check for `undefined`/`null` before string coercion and use an empty string or placeholder.

---

### 17. `esDocFactory` — `origin()` returns a shallow copy **— Importance: High**

**Branch:** both

The `origin()` method copies top-level properties but shares nested object references. Mutations to nested properties in the returned object leak back to the original doc. This is documented by `migrationSafetyTests.js:85-101`.

**Fix:** Use deep copy (`angular.copy` or `JSON.parse(JSON.stringify(...))`) for the returned object.

---

### 18. `Gruntfile.js:36` — `jshint force: true` silently passes lint errors **— Importance: Medium**

**Branch:** both

The `force: true` option means JSHint reports errors but never fails the build, undermining the purpose of having a linter in the build pipeline.

**Fix:** Remove `force: true`.

---

## Low Severity

### 21. `stringPatch.js` — Monkey-patches `String.prototype` globally **— Importance: Low**

**Branch:** both

Adds non-standard `hasSubstr` to `String.prototype`. Modern JS has `String.prototype.includes()`. Global prototype modification risks conflicts with other libraries.

---

### 22. `baseExplainSvc.js:80-83` — `mergeInto` uses `for...in` without `hasOwnProperty` check **— Importance: Low**

**Branch:** both

Copies inherited/prototype properties along with own properties.

---

### 23. `esUrlSvc.js:138` — Fragile `this` binding in `buildUrl` **— Importance: Low**

**Branch:** both

Uses `var self = this` inside a plain function instead of the outer closure's `self`. Inconsistent with other functions in the same file.

---

### 24. `httpJsonpTransportFactory.js:31` — Username containing `:` breaks credential parsing **— Importance: Low**

**Branch:** both

`split(':')` on decoded credentials only uses `[0]` and `[1]`. Usernames with colons or multi-colon passwords are truncated.

---

### 25. `esSearcherPreprocessorSvc.js:73,96` — `delete searcher.args.pager` mutates args destructively **— Importance: Medium**

**Branch:** both

If `prepare` is called multiple times, `pagerArgs` will be `undefined` on subsequent calls.

---

### 26. `resolverFactory.js:132` — `sliceIds` returns `undefined` when `chunkSize <= 0` **— Importance: Medium**

**Branch:** both

No else/return branch. `angular.forEach(undefined, ...)` silently produces empty results with no error.

---

### 27. `resolverFactory.js:153` — `concat.apply` pattern risks stack overflow on large arrays **— Importance: Low**

**Branch:** both

```js
self.docs = self.docs.concat.apply(self.docs, docsChunk);
```

Each element of `docsChunk` becomes a separate argument. Very large arrays can exceed the call stack limit. Also duplicates docs if `fetchDocs` is called twice.

---

### 28. `vectorSvc.js:63` — `add()` overwrites keys instead of summing **— Importance: Low**

**Branch:** both

The service-level `add()` uses `set()` (overwrite) instead of the instance `add()` (sum). Misleading name — behaves as merge-last-wins.

---

### 29. `queryTemplateSvc.js:35` — Unnecessary `/g` flag on `test()` regex **— Importance: Low**

**Branch:** both

```js
} else if (/keyword\d+/g.test(key)) {
```

The `/g` flag is unnecessary for `.test()` and creates stateful behavior. Not currently buggy since the regex is an inline literal (recreated each call), but is bad practice.

---

### 31. `defaultSolrConfig.js` — Default `apiMethod: 'JSONP'` is a security concern **— Importance: Medium** (higher if Solr is exposed or untrusted)

**Branch:** both

JSONP bypasses CORS by injecting `<script>` tags, making it vulnerable to XSS if the Solr server is compromised. Modern Solr supports CORS headers; prefer GET or POST.

---

### 32. `.jshintrc` — Multiple deprecated options **— Importance: Low**

**Branch:** both

`"immed"`, `"regexp"`, `"smarttabs"` were removed in JSHint 2.0+. `"esnext"` is deprecated in favor of `"esversion": 6`. These options are silently ignored.

---

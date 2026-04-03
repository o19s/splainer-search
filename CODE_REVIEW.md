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
| Medium   | 7     |
| Low      | 11    |

---

## Medium Severity

### 10. `solrDocFactory.js:109,111` — Highlight tags used as unescaped regex

**Branch:** both

```js
var preRegex  = new RegExp(self.options().highlightingPre, 'g');
var postRegex = new RegExp(self.options().highlightingPost, 'g');
```

User-configurable highlight strings are passed directly to `new RegExp()`. Tags containing regex metacharacters (`(`, `)`, `+`, `*`, `.`) will throw `SyntaxError` or match incorrectly.

**Fix:** Escape the strings before creating the regex, or use `String.prototype.replaceAll()`.

---

### 14. `resolverFactory.js:32-39` — `escapeIds` is a no-op

**Branch:** both

```js
// SUSS_USE_OF_ESCAPING
ids.push(id);  // no escaping applied
```

The actual escaping call is commented out. Solr IDs with special characters (colons, parens, spaces) will produce malformed Lucene queries.

**Fix:** Re-enable escaping or document why it was intentionally disabled.

---

### 15. `baseExplainSvc.js:95-111` — `toStr()` memoization ignores `depth` parameter

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

### 16. `normalDocsSvc.js` — Missing fields coerced to string `"undefined"`

**Branch:** both

When a nested field path resolves to `undefined`, the code produces the literal string `"undefined"` via `'' + undefined`. Users see "undefined" as document titles or field values.

**Fix:** Check for `undefined`/`null` before string coercion and use an empty string or placeholder.

---

### 17. `esDocFactory` — `origin()` returns a shallow copy

**Branch:** both

The `origin()` method copies top-level properties but shares nested object references. Mutations to nested properties in the returned object leak back to the original doc. This is documented by `migrationSafetyTests.js:85-101`.

**Fix:** Use deep copy (`angular.copy` or `JSON.parse(JSON.stringify(...))`) for the returned object.

---

### 18. `Gruntfile.js:36` — `jshint force: true` silently passes lint errors

**Branch:** both

The `force: true` option means JSHint reports errors but never fails the build, undermining the purpose of having a linter in the build pipeline.

**Fix:** Remove `force: true`.

---

### 20. `solrUrlSvc.js:46` — Incomplete percent-encoding regex

**Branch:** both

```js
rVal = rVal.replace(/\%(?!(2|3|4|5))/g, '%25');
```

Only checks the first hex digit. Valid encodings like `%60`-`%7F` get double-encoded. Invalid encodings like `%2Z` are missed.

**Fix:** Use a proper percent-encoding validation regex that checks both hex digits.

---

## Low Severity

### 21. `stringPatch.js` — Monkey-patches `String.prototype` globally

**Branch:** both

Adds non-standard `hasSubstr` to `String.prototype`. Modern JS has `String.prototype.includes()`. Global prototype modification risks conflicts with other libraries.

---

### 22. `baseExplainSvc.js:80-83` — `mergeInto` uses `for...in` without `hasOwnProperty` check

**Branch:** both

Copies inherited/prototype properties along with own properties.

---

### 23. `esUrlSvc.js:138` — Fragile `this` binding in `buildUrl`

**Branch:** both

Uses `var self = this` inside a plain function instead of the outer closure's `self`. Inconsistent with other functions in the same file.

---

### 24. `httpJsonpTransportFactory.js:31` — Username containing `:` breaks credential parsing

**Branch:** both

`split(':')` on decoded credentials only uses `[0]` and `[1]`. Usernames with colons or multi-colon passwords are truncated.

---

### 25. `esSearcherPreprocessorSvc.js:73,96` — `delete searcher.args.pager` mutates args destructively

**Branch:** both

If `prepare` is called multiple times, `pagerArgs` will be `undefined` on subsequent calls.

---

### 26. `resolverFactory.js:132` — `sliceIds` returns `undefined` when `chunkSize <= 0`

**Branch:** both

No else/return branch. `angular.forEach(undefined, ...)` silently produces empty results with no error.

---

### 27. `resolverFactory.js:153` — `concat.apply` pattern risks stack overflow on large arrays

**Branch:** both

```js
self.docs = self.docs.concat.apply(self.docs, docsChunk);
```

Each element of `docsChunk` becomes a separate argument. Very large arrays can exceed the call stack limit. Also duplicates docs if `fetchDocs` is called twice.

---

### 28. `vectorSvc.js:63` — `add()` overwrites keys instead of summing

**Branch:** both

The service-level `add()` uses `set()` (overwrite) instead of the instance `add()` (sum). Misleading name — behaves as merge-last-wins.

---

### 29. `queryTemplateSvc.js:35` — Unnecessary `/g` flag on `test()` regex

**Branch:** both

```js
} else if (/keyword\d+/g.test(key)) {
```

The `/g` flag is unnecessary for `.test()` and creates stateful behavior. Not currently buggy since the regex is an inline literal (recreated each call), but is bad practice.

---

### 31. `defaultSolrConfig.js` — Default `apiMethod: 'JSONP'` is a security concern

**Branch:** both

JSONP bypasses CORS by injecting `<script>` tags, making it vulnerable to XSS if the Solr server is compromised. Modern Solr supports CORS headers; prefer GET or POST.

---

### 32. `.jshintrc` — Multiple deprecated options

**Branch:** both

`"immed"`, `"regexp"`, `"smarttabs"` were removed in JSHint 2.0+. `"esnext"` is deprecated in favor of `"esversion": 6`. These options are silently ignored.

---

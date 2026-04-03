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
| Medium   | 14    |
| Low      | 13    |

---

## Medium Severity

### 7. `queryExplainSvc.js:40` — Dead code: regex has no capture group

**Branch:** both

```js
var weightRegex = /^weight\((?!FunctionScoreQuery).*/;
if (match !== null && match.length > 1) {  // always false — no capture groups
    this.realExplanation = match[1];        // never reached
```

The `(?!...)` is a lookahead, not a capture group. `match.length` is always 1, so the if-branch is dead code.

**Fix:** Add a capture group to the regex: `/^weight\(((?!FunctionScoreQuery).*)\)/`.

---

### 8. `esSearcherPreprocessorSvc.js:93` — Query text not URL-encoded

**Branch:** both

```js
searcher.url = searcher.url + '?q=' + searcher.queryText;
```

Special characters (`&`, `#`, `=`, spaces) in queries will corrupt the URL.

**Fix:** `searcher.url = searcher.url + '?q=' + encodeURIComponent(searcher.queryText);`

---

### 9. Multiple files — `JSON.parse(customHeaders)` without try/catch

**Branch:** both

- `esUrlSvc.js:192`
- `vectaraUrlSvc.js:17`
- `searchSvc.js:56`

Invalid JSON in user-provided custom headers throws an unhandled `SyntaxError` that crashes the calling code.

**Fix:** Wrap in try/catch, log a warning, and fall back to empty headers.

---

### 10. `solrDocFactory.js:109,111` — Highlight tags used as unescaped regex

**Branch:** both

```js
var preRegex  = new RegExp(self.options().highlightingPre, 'g');
var postRegex = new RegExp(self.options().highlightingPost, 'g');
```

User-configurable highlight strings are passed directly to `new RegExp()`. Tags containing regex metacharacters (`(`, `)`, `+`, `*`, `.`) will throw `SyntaxError` or match incorrectly.

**Fix:** Escape the strings before creating the regex, or use `String.prototype.replaceAll()`.

---

### 11. `vectaraDocFactory.js:58-65` — Crash if document has no metadata

**Branch:** both

```js
const metadata = self.metadata;
return metadata.reduce(...)  // TypeError if metadata is null/undefined
```

**Fix:** Default to empty array: `const metadata = self.metadata || [];`

---

### 12. `algoliaSearchFactory.js:180-181` — Wrong response shape for object retrieval

**Branch:** both

```js
self.numFound = data.nbHits;   // undefined for /objects endpoint
self.nbPages = data.nbPages;   // undefined — breaks pager comparison
```

The Algolia `/1/indexes/*/objects` endpoint returns `{ results: [...] }` without `nbHits` or `nbPages`. Pager logic breaks because `undefined - 1` is `NaN`.

**Fix:** Conditionally set `numFound` from `data.results.length` when using the objects endpoint.

---

### 13. `searchApiSearcherFactory.js:52-55` — `pager()` returns `undefined` instead of `null`

**Branch:** both

```js
function pager() {
    console.log('Pager');
    // no return — implicitly returns undefined
}
```

Other searcher factories return `null` to signal "no more pages." `undefined` is truthy, so callers will attempt pagination on a non-existent searcher.

**Fix:** Return `null` explicitly.

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

### 19. `Gruntfile.js` — `uglify` task configured but never wired into any registered task

**Branch:** both

The `uglify` config exists, but neither `default` nor `build` tasks include it. `splainer-search.min.js` is never produced.

**Fix:** Add `'uglify'` to the `default` or `build` task, or remove the dead config.

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

### 30. `package.json` — AngularJS 1.8.3 is end-of-life

**Branch:** both

AngularJS reached EOL on December 31, 2021. No security patches are available.

---

### 31. `defaultSolrConfig.js` — Default `apiMethod: 'JSONP'` is a security concern

**Branch:** both

JSONP bypasses CORS by injecting `<script>` tags, making it vulnerable to XSS if the Solr server is compromised. Modern Solr supports CORS headers; prefer GET or POST.

---

### 32. `.jshintrc` — Multiple deprecated options

**Branch:** both

`"immed"`, `"regexp"`, `"smarttabs"` were removed in JSHint 2.0+. `"esnext"` is deprecated in favor of `"esversion": 6`. These options are silently ignored.

---

### 33. `queryExplainSvc.js:109-111` — `MinExplain.influencers()` crashes on empty children

**Branch:** both

```js
this.influencers = function() {
    var infl = shallowArrayCopy(this.children);
    infl.sort(function(a, b) { return a.score - b.score; });
    return [infl[0]];  // undefined if children is empty
};
```

Same pattern exists in `DismaxExplain.vectorize()` (line 183) and `DismaxTieExplain.vectorize()` (line 161).

**Fix:** Guard against empty children arrays.

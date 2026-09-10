[![npm version](https://badge.fury.io/js/splainer-search.svg)](https://badge.fury.io/js/splainer-search)

# Splainer Search

Splainer Search is a plain-JavaScript (ESM) search library that supports [Solr](https://solr.apache.org/), [OpenSearch](https://opensearch.org/) and [Elasticsearch](https://www.elastic.co/) and is focused on relevance diagnostics with some experimental support for other search engines, including [Algolia](https://www.algolia.com/doc/) and [Vectara](https://www.vectara.com).

It's used in the relevancy tuning tools [Quepid](http://quepid.com) and [Splainer](http://splainer.io). It is available for anyone to use (see [license](LICENSE.txt)).

> **Note:** From **v3.0.0** onward, splainer-search is a plain ESM library with no AngularJS dependency. The npm badge above shows the **latest published** version; if you are still on **2.x**, see [CHANGELOG.md](CHANGELOG.md) for migration notes — most notably, `angular.forEach` examples below have become plain `for…of` loops. For **Splainer and Quepid**, prefer the **wired** entry (below).

## Splainer, Quepid, and other full apps

Use the **`splainer-search/wired.js`** (or **`splainer-search/wired`**) entry so you get the same service graph the library tests use (`fieldSpecSvc`, `searchSvc`, `createSearcher`, ...) without copying wiring into your repo:

```js
import { createWiredServices, createFetchClient } from 'splainer-search/wired.js';

var httpClient = createFetchClient({
  credentials: 'include', // optionally: send cookies on cross-origin requests (Solr/search API must allow CORS)
  // fetch: globalThis.fetch, // optionally: custom fetch for CSRF headers, tracing, or tests
});
var api = createWiredServices(httpClient);
var fieldSpecSvc = api.fieldSpecSvc;
var searchSvc = api.searchSvc;

var fields = fieldSpecSvc.createFieldSpec('id title hl:body author');
var searcher = searchSvc.createSearcher(
  fields,
  'http://localhost:8983/solr/select',
  { q: ['*:*'] }
);
```

**`<script>` tags (no bundler):** run **`npm run build`** in this repo so **`dist/`** exists, or use the same files from a published install under **`node_modules/splainer-search/dist/`**. **URI.js must load first** (the IIFE expects `globalThis.URI`). Then load either the **wired** bundle or the **barrel** bundle:

| Script | Global | Use when |
|--------|--------|----------|
| **`dist/splainer-search-wired.js`** | **`SplainerSearchWired`** | You want **`createWiredServices`** / **`createFetchClient`** like the ESM example above (Splainer / Quepid style). |
| **`dist/splainer-search.js`** | **`SplainerSearch`** | You import named constructors only and wire dependencies yourself. |

Example (wired bundle — adjust script `src` paths to where you serve **URI.js** and the vendored **`splainer-search-wired.js`** file):

```html
<script src="https://cdn.jsdelivr.net/npm/urijs@1.19.11/src/URI.min.js"></script>
<script src="./node_modules/splainer-search/dist/splainer-search-wired.js"></script>
<script>
  var httpClient = SplainerSearchWired.createFetchClient({
    credentials: 'include', // optional: cross-origin cookies (needs CORS)
  });
  var api = SplainerSearchWired.createWiredServices(httpClient);
  var fields = api.fieldSpecSvc.createFieldSpec('id title hl:body author');
  var searcher = api.searchSvc.createSearcher(
    fields,
    'http://localhost:8983/solr/select',
    { q: ['*:*'] }
  );
</script>
```

---

Splainer Search utilizes a JSONP wrapper for communication with Solr. Elasticsearch, OpenSearch, Algolia, and Vectara use simple HTTP and JSON via CORS. For Algolia, Vectara, and Elasticsearch/OpenSearch, you can pass extra HTTP headers in **`config.customHeaders`** as a **JSON string** (see the examples below); the library merges that into outbound requests. Solr can use the same field when using GET/POST transports that accept headers.

All fields are explained and highlighted when the backend supports it and you request it. A friendly interface is provided to specify the arguments in terms of a JavaScript object. See below for basic examples.

## Basic usage

The **first argument** to `searchSvc.createSearcher` must be a **field spec object** from **`fieldSpecSvc.createFieldSpec(string)`** (for example `'id title hl:body'` or `'id:_id title'`). It is not a plain JavaScript array of field names. The snippets below assume `searchSvc` and `fieldSpecSvc` come from **`createWiredServices`** (as in the example above).

### Solr

Splainer-search will perform the specified search against Solr attempting to highlight and extract explain info. To request highlighting on a specific field, prefix the fieldname with `"hl:"` i.e: `hl:overview`.

```js
// searcher that searches id, title, body, author (hl: marks highlight fields)
var fields = fieldSpecSvc.createFieldSpec('id title hl:body author');
var searcher = searchSvc.createSearcher(
  fields,
  'http://localhost:8983/solr/select',
  {
    'q': ['*:*'],
    'fq': ['title:Moby*', 'author:Herman']
  }
);

searcher.search()
.then(function() {
  for (const doc of searcher.docs) {
    console.log(doc.source().title);
    // highlights. You need to pass id as that's how Solr
    // organizes the explain. See below for a friendlier/higher-level
    // interface with normalDocs
    console.log(doc.highlight(doc.source().id, 'title', '<b>', '</b>'));
    // explain info
    console.log(doc.explain(doc.source().id));
  }
});
```

### Solr's JSON Query DSL

By default, Solr requests use classic `q=...&fq=...` query-string parameters. Set **`config.jsonQueryDsl: true`** to instead send a [JSON Query DSL](https://solr.apache.org/guide/solr/latest/query-guide/json-query-dsl.html) request body — useful for nested `bool`/`edismax` queries that don't map cleanly onto flat query-string params.

```js
var fields = fieldSpecSvc.createFieldSpec('id title');
var searcher = searchSvc.createSearcher(
  fields,
  'http://localhost:8983/solr/select',
  { query: 'title:#$query##' },
  'moby dick',
  { jsonQueryDsl: true }
);

searcher.search();
```

A few things behave differently from classic Solr requests:

- **Always POST.** JSONP and GET can't carry a request body, so a JSON DSL request always POSTs regardless of `config.apiMethod`.
- **`config.escapeQuery`, `config.debug`, and `config.highlight`** work the same as classic mode, just expressed as JSON body values nested under a `"params"` key instead of query-string params — merged into any `params` your own template already defines, rather than overwriting them.
- **`fields`/`limit`** are defaulted from your field spec / `config.numberOfRows` only if your own template doesn't already set them — an explicit value in a hand-written template always wins.
- **Paging** uses `limit`/`offset` (scalar values), not classic Solr's `rows`/`start`.
- **`explainOther()`** nests its `explainOther` param under `params` too, since Solr's JSON Request API only accepts a fixed set of top-level keys and rejects unknown ones.
- **`searcher.linkUrl`** (the "open in Solr" link) embeds the whole JSON body as Solr's own `json=` query parameter, since a POST body itself has nothing to link to — this returns identical results to the POST request, so it doubles as a shareable debug URL.

### Elasticsearch and OpenSearch

Splainer-search supports these search engines using the same client code path and the query DSL shape Elasticsearch expects. Pass **`'es'`** or **`'os'`** as the **sixth** argument to `createSearcher` so the library does not default to Solr. OpenSearch uses the same implementation as Elasticsearch; **`'os'`** is mainly for correct labeling and for tooling (for example URL validation) that cares which engine you use.

The **fourth** argument is the query string used to replace **`#$query##`** (and related template placeholders) in the DSL; the **fifth** is optional **`config`** (see [Specifying search engine version number](#specifying-search-engine-version-number)).

```js
var fields = fieldSpecSvc.createFieldSpec('id:_id title body author');
var searcher = searchSvc.createSearcher(
  fields,
  'http://localhost:9200/books/_search',
  {
    'query': {
      'match': {
        'title': '#$query##'
      }
    }
  },
  'moby dick',
  {},
  'es' // use 'os' for OpenSearch
);
```

### Algolia

Splainer-search has experimental support for [Algolia](https://www.algolia.com/doc/) search. Use an index **query** URL (`…/1/indexes/{index}/query`), pass the sixth argument as **`'algolia'`**, and supply Algolia headers on **`config.customHeaders`** (a JSON string). The query string placeholder **`#$query##`** in the request body is replaced with the `queryText` argument, same as for other engines.

```js
var fields = fieldSpecSvc.createFieldSpec('id:objectID title description');
var searcher = searchSvc.createSearcher(
  fields,
  'https://YOUR_APP_ID-dsn.algolia.net/1/indexes/products/query',
  {
    query: '#$query##',
    hitsPerPage: 10,
    page: 0,
    attributesToRetrieve: ['objectID', 'title', 'description'],
  },
  'laptop',
  {
    apiMethod: 'POST',
    customHeaders: JSON.stringify({
      'X-Algolia-Application-Id': 'YOUR_APP_ID',
      'X-Algolia-API-Key': 'YOUR_SEARCH_API_KEY',
    }),
  },
  'algolia'
);
```

Use **`apiMethod: 'GET'`** or **`'POST'`** depending on how you want the query sent; the tests cover both. Explain and some other advanced Splainer-search features are not available for Algolia in the same way as for Solr or Elasticsearch.

### Vectara

Splainer-search has experimental support for Vectara. You can send queries in the Vectara format but must also pass in
the authorization headers as custom headers, e.g.

```js
var fields = fieldSpecSvc.createFieldSpec('id:_id title body author');
var searcher = searchSvc.createSearcher(
  fields,
  'https://api.vectara.io:443/v1/query',
  {
    "query": [
      {
        "query": "#$query##",
        "numResults": 10,
        "corpusKey": [
          {
            "customerId": 123456789,
            "corpusId": 1
          }
        ]
      }
    ]
  },
  'your query text',
  {
    customHeaders: JSON.stringify({
      'customer-id': '123456789',
      'x-api-key': 'api_key',
    }),
  },
  'vectara'
);
```

Please note that the Vectara integration currently does not support explain or other advanced Splainer-search functionality.

### Custom Search API

Splainer-search has experimental support for Custom APIs. You can send in queries as GET or POST and your API must respond with a JSON formatted response.

The magic of the Custom Search API is that you provide some *mapping* JavaScript code to convert from the JSON format of your API to the native structures that splainer-search uses. Imagine your response looks like:

```js
[
    {
        "publication_id": "12345678",
        "publish_date_int": "20230601",
        "score": 0.5590707659721375,
        "title": "INFOGRAPHIC: Automakers' transition to EVs speeds up"
    },
    {
        "publication_id": "1234567",
        "publish_date_int": "20230608",
        "score": 0.5500463247299194,
        "title": "Tesla - March 2023 (LTM): Peer Snapshot"
    }
];
```

Then you would define two custom mappers, where `data` is your JSON:

```js
var options = { apiMethod: 'GET' };
options.numberOfResultsMapper = function(data){
  return data.length;
}
options.docsMapper = function(data){    
  let docs = [];
  for (let doc of data) {
    docs.push ({
      id: doc.publication_id,
      publish_date_int: doc.publish_date_int,
      title: doc.title,
    })
  }
  return docs
}
```

Pass **`options`** as the **fifth** argument (searcher `config`), and use an **args** object whose values can carry the **`#$query##`** placeholder (here the key is `query`). The **fourth** argument is the query text applied to that template.

```js
var fields = fieldSpecSvc.createFieldSpec('id:publication_id title publish_date_int');
var args = { query: '#$query##' };
var searcher = searchSvc.createSearcher(
  fields,
  'http://mycompany.com/api/search',
  args,
  'tesla',
  options,
  'searchapi'
);
```

#### Automatic GET/POST switching

Custom Search API supports a third **`apiMethod: 'AUTO'`** option, alongside `'GET'`/`'POST'`: splainer-search builds the candidate GET URL and sends it as a GET if it fits within **`config.maxGetUrlLength`** (default **2000** characters), falling back to POST if it doesn't. This is handy when query length varies a lot and you'd rather not always pay POST's extra overhead just to handle the occasional long query.

```js
var options = {
  apiMethod: 'AUTO',
  maxGetUrlLength: 4000, // optional; defaults to 2000
  numberOfResultsMapper: function(data) { return data.length; },
  docsMapper: function(data) { /* ... */ },
};
```

If you're also proxying requests via **`config.proxyUrl`**, its length is included when deciding GET vs. POST, since that's what actually goes out over the wire.


## Paging

Paging is done by asking the original searcher for another searcher. This searcher is already setup to get the next page for the current search results. Tell that searcher to `search()` just like you did above.

```js
var results = [];
searcher.search()
.then(function() {
  for (const doc of searcher.docs) {
    results.push(doc.source().title);
  }
  // once results returned, get a new searcher for the next
  // page of results, just rerun the search later exactly as
  // its run here
  searcher = searcher.pager();
});

// sometime later we page...
searcher.search()
.then(function() {

});
```

## Explain Other

Let's say you have performed a search for `tacos` and you get a bunch of results, but the chef comes back to you and says:

> Hey! My new creation "La Bomba" is not showing up, fix it!!!!

So you are puzzled as to why it is not showing up, since it's clearly marked as a `taco` in the db. Wouldn't it be nice if `splainer-search` gave you some help?

Don't worry, we've got your back :)

### Solr

So assuming you already have something like this:

```js
var fields = fieldSpecSvc.createFieldSpec('id title price');
var options = {
  url:          'http://localhost:8983/solr/select',
  args:         { 'q': ['#$query##'] },
  query:        'tacos',
  config:       {},
  searchEngine: 'solr'
};
var searcher = searchSvc.createSearcher(fields, options.url, options.args, options.query, options.config, options.searchEngine);

searcher.search();
```

You would want to create a new searcher with the same options/context, and use the `explainOther()` function:

```js
var explainSearcher = searchSvc.createSearcher(fields, options.url, options.args, options.query, options.config, options.searchEngine); // same options as above

// assuming that we know "El Bomba" has id 63148
explainSearcher.explainOther('id:63148', fields);
```

The `explainOther()` function returns the same promise as the `search()` function so you can retrieve the results in the same way.

### Elasticsearch / OpenSearch

In ES/OS, the `explainOther()` function behaves the same way, except that it does not need a `fieldSpec` param to be passed in.

```js
var fields = fieldSpecSvc.createFieldSpec('id title price');
var options = {
  url:          'http://localhost:9200/tacos/_search',
  args:         {
    'query': {
      'match': {
        'title': '#$query##'
      }
    }
  },
  query:        'tacos',
  config:       {},
  searchEngine: 'es' // or 'os' for OpenSearch
};
var searcher = searchSvc.createSearcher(fields, options.url, options.args, options.query, options.config, options.searchEngine);

searcher.search();

var explainSearcher = searchSvc.createSearcher(fields, options.url, options.args, options.query, options.config, options.searchEngine); // same options as above

// assuming that we know "El Bomba" has id 63148
explainSearcher.explainOther('id:63148');
```

The `explainOther()` function returns the same promise as the `search()` function so you can retrieve the results in the same way.

## Validating a search endpoint

Before wiring up a real query, it's often useful to check that a URL/settings combination actually works and to discover what fields come back - this is what powers the "test this endpoint" step in tools like Quepid's Create-a-Case wizard.

`searchSvc.createValidator(settings)` returns a searcher pre-configured with a sensible default query for the given `settings.searchEngine` (Solr: `q=*:*`; Elasticsearch/OpenSearch: match everything; Vectara: a sample query against `corpusKey: 1`; anything else uses `settings.args` as-is, if provided). Call `validateUrl()` on it, then inspect `.fields` (every field seen across the returned docs) and `.idFields` (fields present on every doc - candidates for a unique id field):

```js
var validator = searchSvc.createValidator({
  searchEngine: 'solr',
  searchUrl: 'http://localhost:8983/solr/select',
});

validator.validateUrl().then(function () {
  console.log('Available fields:', validator.fields);
  console.log('Candidate id fields:', validator.idFields);
});
```

`validator.fields`/`validator.idFields` start out as empty arrays as soon as `createValidator()` returns, so it's safe to read them even before `validateUrl()` resolves - or without ever calling it at all, for example if a user opts to skip validation.

## Normalizing docs with normalDocs/fieldSpec

This library was originally written for dealing with debug tools such as [Quepid](http://quepid.com) and [Splainer](http://splainer.io). As such, it provides a lot of help taking a user specified list of fields and associated roles, then once search is done turning the raw docs out of the Solr searcher into something more normalized based on that config (a normalDoc).

The normalDoc provides a friendlier, more standard interface. This includes friendlier parsing of explain information as needed.

```js
var userFieldSpec = "id:uuid, title, body, authors"
var fs = fieldSpecSvc.createFieldSpec(userFieldSpec)
var searcher = searchSvc.createSearcher(
  fs,
  'http://localhost:8983/solr/select',
  {
    'q': ['*:*'],
    'fq': ['title:Moby*', 'authors:Herman']
  }
);

searcher.search()
.then(function() {
  var bestScore = 0;
  for (const doc of searcher.docs) {
    var normalDoc = normalDocsSvc.createNormalDoc(fs, doc);
    // access unique id and title
    // (above specified to be uuid and title)
    console.log("ID is:" + normalDoc.id);
    console.log("Title is:" + normalDoc.title);

    // snippets -- best try to highlight the field
    for (const [fieldName, snippet] of Object.entries(normalDoc.subSnippets)) {
      console.log('hopefully this is a highlight! ' + snippet);
    }

    // prettier and heavily sanitized explain info:
    // (the explain modal on Splainer shows this)
    console.log(normalDoc.explain());

    // hot matches contains the most important matches
    // this drives the horizontal graph bars in Quepid/Splainer
    var matches = normalDoc.hotMatches();

    // Give hotMatchesOutOf a maximum score (for all docs returned) and you'll
    // get the hot matches as a percentage of the whole
    if (normalDoc.score() > bestScore) {
      bestScore = normalDoc.score();
    }
    normalDoc.hotMatchesOutOf(bestScore);

    // a link to the document in Solr is handy:
    console.log(normalDoc._url())
  }
});
```

## Resolving documents by ID

Given a case/report built independently of live search results (for example, a saved snapshot, or a list of previously-rated document ids), you often need to fetch just those specific documents back from the search engine to redisplay them. `docResolverSvc` does that lookup and returns the same NormalDocs described above.

```js
var resolver = docResolverSvc.createResolver(
  ['doc1', 'doc2', 'doc3'],
  {
    searchEngine: 'solr',
    searchUrl: 'http://localhost:8983/solr/select',
    createFieldSpec: function () {
      return fieldSpecSvc.createFieldSpec('id title body');
    },
  },
);

resolver.fetchDocs().then(function () {
  for (const doc of resolver.docs) {
    console.log(doc.id, doc.title);
  }
});
```

Any id that isn't found comes back as a placeholder "Missing Doc" stub instead of being silently dropped, so the result always has exactly one entry per requested id, in the order requested.

Pass a `chunkSize` as the third argument to split a large id list into parallel batched requests instead of one huge query:

```js
resolver = docResolverSvc.createResolver(hundredsOfIds, settings, 50); // 50 ids per request
```

Not every search engine supports looking documents up directly by id - Vectara and a generic Custom Search API endpoint don't have a standard way to do this, so every requested id comes back as a placeholder stub for those two engines.

## Specifying search engine version number

Most of what splainer-search does should be compatible with all versions of Solr and Elasticsearch. There are times though where one of these projects introducing a breaking change and it becomes necessary to specify the version number used.

For example, ES deprecated the `fields` parameter in favor of `stored_fields`. So it's necessary to tell splainer-search which version you are using in order to send the appropriate request.

To do so you only need to specify the version number in the `config` param when constructing a new searcher:

### Elasticsearch

```js
var fields = fieldSpecSvc.createFieldSpec('id title price');
var options = {
  url:          'http://localhost:9200/tacos/_search',
  args:         {
    'query': {
      'match': {
        'title': '#$query##'
      }
    }
  },
  query:        'tacos',
  config:       { version: 5.1 },
  searchEngine: 'es' // or 'os' for OpenSearch
};
var searcher = searchSvc.createSearcher(fields, options.url, options.args, options.query, options.config, options.searchEngine);

searcher.search();
```

And splainer-search will take care of using the correct name in the parameters.

**NB:** The default ES config uses version **5.0** (see `values/defaultESConfig.js`), so 5.x-style behavior applies unless you override `config.version` (string or number is accepted).


## Highlighting of results

If the individual search result field is a string then it is automatically highlighted.

However, if the selected value is an array or a JSON object, it doesn't coerce it to a string (and as a result doesn't highlight it, either).

Secondly, if any component in the selected path results in an array, the rest of the path is spread over the array value. To explain:

```
Data: { "variants": [ { "name": "red" }, { "name": "blue" } ] }
Path (or _field name_): "variants.name"
Result: [ "red", "blue" ]
```

## Understanding query parameters

Sometimes we want to understand what queries are being sent to the search engine, and it can be a bit opaque if we are going through an API or if we have parameters being appended inside the search engine (think Paramsets in Solr or templates in ES). The property used for that is **engine-specific** (Solr uses **`searcher.queryDetails`**; see below).

### Solr

Solr exposes effective request parameters on the response as **`responseHeader.params`**. Splainer-search copies that object onto **`searcher.queryDetails`**.

Send `echoParams=all` (or similar) to Solr so `responseHeader.params` is populated.

### Elasticsearch/OpenSearch

There is no direct equivalent to Solr’s `echoParams` / `responseHeader.params`. For **how the executed query was processed**, use the **`profile`** response (see the next section): the library stores that under the same `searcher.parsedQueryDetails` property when profiling is present.

## Understanding query input parsing

Frequently we want to understand what the search engine is doing to the raw query input. Consult the `searcher.parsedQueryDetails` property to get a search engine specific JSON data structure.

### Solr

For Solr we copy keys from the `debug` section of the response into `searcher.parsedQueryDetails`, **except** `track`, `timing`, `explain`, and `explainOther`. Querqy-related fields from the top-level response may also be merged in (see [Querqy](#querqy-rules-library-support) below).

### Elasticsearch/OpenSearch

In ES/OS we default to `profile=true`, and map everything nested under the `profile` key in the response to the `searcher.parsedQueryDetails` property.

## Querqy Rules Library Support

[Querqy](https://querqy.org/) is a query rewriting library. It helps you to tune your search results for specific search terms. Understanding what Querqy is doing to your queries is critical to achieving great search results.

### Solr

The `searcher.parsedQueryDetails` property surfaces all the debugging information about what rewriting Querqy is doing to the input query. Assuming you are also requesting the details on what rules are being matched via the `querqy.infoLogging=on` query parameter, then you will also see that information in the `searcher.parsedQueryDetails` structure.


## Developing this repo

Contributors need **Node.js 20.12+** (Vitest 4 / tooling). See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for install, `npm test`, lint, build, and release notes.

## Thanks to...

Development for this library is done primarily by [OpenSource Connections](http://opensourceconnections.com) for search relevance tools [Splainer](http://splainer.io) and [Quepid](http://quepid.com)

Original author is [Doug Turnbull](http://softwaredoug.com)

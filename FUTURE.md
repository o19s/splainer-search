# Future Considerations

## JSONP Deprecation

The default Solr transport uses JSONP (`apiMethod: 'JSONP'` in `defaultSolrConfig.js`). JSONP exists to bypass CORS restrictions on older Solr deployments that don't send CORS headers.

As of the Phase 3 migration, JSONP is preserved via `<script>` tag injection in `httpClient.js`, matching the behavior Angular's `$http.jsonp()` provided. However, JSONP has significant downsides:

- **Security**: JSONP injects remote code via `<script>` tags, making it vulnerable to XSS if the Solr server is compromised.
- **Limited**: JSONP only supports GET requests, cannot send custom headers, and has no proper error handling (no HTTP status codes on failure).
- **Legacy**: Modern Solr supports CORS headers natively. All other search engines in splainer-search (Elasticsearch, OpenSearch, Algolia, Search.io, Vectara) use GET/POST with CORS.

**Recommendation**: In a future semver-major release, change the default `apiMethod` from `'JSONP'` to `'GET'` and deprecate JSONP support. Document that Solr users should configure CORS headers on their Solr server.

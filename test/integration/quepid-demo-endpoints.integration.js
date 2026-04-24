'use strict';

/**
 * Live integration tests against O19s-hosted Quepid TMDB demo Solr, Elasticsearch,
 * and OpenSearch endpoints (same defaults as the Quepid case wizard).
 *
 * @see https://github.com/o19s/quepid/blob/main/app/javascript/modules/wizard_settings.js
 *
 * Run: `npm run test:integration:demo` (requires outbound network; uses Node’s global `fetch`).
 *
 * Assertions (beyond “got hits”): no `inError`, page size respected, first doc id shape,
 * `activeQueries` returned to zero — enough to catch wiring regressions without pinning
 * TMDB field values that could change on the server.
 *
 * Optional environment overrides:
 * - `SPLAINER_SEARCH_DEMO_SOLR_URL` — default is HTTP on port 8985 (Quepid’s `insecureSearchUrl`);
 *   the wizard’s HTTPS Solr URL may not expose 443 in all environments.
 * - `SPLAINER_SEARCH_DEMO_ES_URL`
 * - `SPLAINER_SEARCH_DEMO_OS_URL`
 */

import assert from 'assert';
import { createFetchClient } from '../../services/httpClient.js';
import { getSearchSvc, getFieldSpecSvc } from '../vitest/helpers/serviceFactory.js';
import { activeQueries } from '../../values/activeQueries.js';

var DEMO_SOLR_URL =
  process.env.SPLAINER_SEARCH_DEMO_SOLR_URL ||
  'http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select';
var DEMO_ES_URL =
  process.env.SPLAINER_SEARCH_DEMO_ES_URL ||
  'http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search';
var DEMO_OS_URL =
  process.env.SPLAINER_SEARCH_DEMO_OS_URL ||
  'https://quepid-opensearch.dev.o19s.com:9000/tmdb/_search';

var liteSolrConfig = {
  apiMethod: 'GET',
  sanitize: true,
  highlight: false,
  debug: false,
  escapeQuery: false,
  numberOfRows: 5,
};

var liteEsConfig = {
  highlight: false,
  debug: false,
  escapeQuery: false,
  numberOfRows: 5,
};

/**
 * @param {object} searcher - After `await searcher.search()`
 * @param {string} label - Log label (engine name)
 * @param {number} pageSize - `numberOfRows` for this search
 * @param {'solr'|'es'} idKind - Solr docs use `id`; ES/OS hits expose `_id` on the doc wrapper
 */
function assertDemoSearchShape(searcher, label, pageSize, idKind) {
  assert.strictEqual(searcher.inError, false, label + ': searcher.inError should be false');
  assert.ok(searcher.numFound > 0, label + ': numFound should be > 0');
  assert.ok(searcher.docs.length >= 1, label + ': at least one doc in the page');
  assert.ok(
    searcher.docs.length <= pageSize,
    label + ': docs length should not exceed numberOfRows',
  );
  assert.ok(
    searcher.numFound >= searcher.docs.length,
    label + ': numFound should be at least the returned page size',
  );
  var d0 = searcher.docs[0];
  if (idKind === 'solr') {
    assert.ok(d0.id != null && String(d0.id).length > 0, label + ': first Solr doc should have id');
  } else {
    assert.ok(
      d0._id != null && String(d0._id).length > 0,
      label + ': first ES/OS doc should have _id on the hit',
    );
  }
  assert.strictEqual(
    activeQueries.count,
    0,
    label + ': activeQueries should be balanced after search',
  );
}

async function runSolrDemo(searchSvc, fieldSpecSvc) {
  activeQueries.count = 0;
  var fieldSpec = fieldSpecSvc.createFieldSpec('id:id title:title');
  var args = { q: ['#$query##'] };
  var searcher = searchSvc.createSearcher(
    fieldSpec,
    DEMO_SOLR_URL,
    args,
    'movie',
    liteSolrConfig,
    'solr',
  );
  await searcher.search();
  assertDemoSearchShape(searcher, 'Solr (Quepid TMDB demo)', liteSolrConfig.numberOfRows, 'solr');
}

async function runEsDemo(searchSvc, fieldSpecSvc) {
  activeQueries.count = 0;
  var fieldSpec = fieldSpecSvc.createFieldSpec('id:_id title:title');
  var matchAll = { query: { match_all: {} } };
  var searcher = searchSvc.createSearcher(fieldSpec, DEMO_ES_URL, {}, matchAll, liteEsConfig, 'es');
  await searcher.search();
  assertDemoSearchShape(
    searcher,
    'Elasticsearch (Quepid TMDB demo)',
    liteEsConfig.numberOfRows,
    'es',
  );
}

async function runOsDemo(searchSvc, fieldSpecSvc) {
  activeQueries.count = 0;
  var fieldSpec = fieldSpecSvc.createFieldSpec('id:_id title:title');
  var matchAll = { query: { match_all: {} } };
  var osConfig = Object.assign({}, liteEsConfig, {
    basicAuthCredential: 'reader:reader',
  });
  var searcher = searchSvc.createSearcher(fieldSpec, DEMO_OS_URL, {}, matchAll, osConfig, 'os');
  await searcher.search();
  assertDemoSearchShape(searcher, 'OpenSearch (Quepid TMDB demo)', liteEsConfig.numberOfRows, 'es');
}

async function main() {
  var httpClient = createFetchClient();
  var searchSvc = getSearchSvc(httpClient);
  var fieldSpecSvc = getFieldSpecSvc();

  console.log('Solr:', DEMO_SOLR_URL);
  await runSolrDemo(searchSvc, fieldSpecSvc);
  console.log('quepid-demo-endpoints: Solr OK');

  console.log('Elasticsearch:', DEMO_ES_URL);
  await runEsDemo(searchSvc, fieldSpecSvc);
  console.log('quepid-demo-endpoints: Elasticsearch OK');

  console.log('OpenSearch:', DEMO_OS_URL);
  await runOsDemo(searchSvc, fieldSpecSvc);
  console.log('quepid-demo-endpoints: OpenSearch OK');

  console.log('quepid-demo-endpoints.integration: OK');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});

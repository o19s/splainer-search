'use strict';

/**
 * Integration test: chunked docResolver Solr fetches use real HTTP against a local TCP
 * server. Verifies that when one chunk's request fails, the combined promise rejects.
 *
 * Run: npm run test:integration
 *
 * Uses `createFetchClient({ jsonpRequest })` to inject a Node-friendly JSONP
 * implementation (HTTP GET + JSON parse) instead of relying on <script> tag
 * injection, which requires a full browser DOM.
 */

import http from 'http';
import assert from 'assert';
import { createFetchClient } from '../../services/httpClient.js';
import { getDocResolverSvc, getFieldSpecSvc } from '../vitest/helpers/serviceFactory.js';

function startMockSolrServer() {
  return new Promise(function (resolve, reject) {
    var server = http.createServer(function (req, res) {
      var u;
      try {
        u = new URL(req.url, 'http://127.0.0.1');
      } catch (_e) {
        res.statusCode = 400;
        res.end();
        return;
      }

      var qRaw = u.searchParams.get('q') || '';
      var q;
      try {
        q = decodeURIComponent(qRaw);
      } catch (_e2) {
        q = qRaw;
      }

      function solrBody(id) {
        return JSON.stringify({
          response: { numFound: 1, docs: [{ id: id, field: 't' }] },
          responseHeader: { status: 0, params: {} },
        });
      }

      // Chunk for doc2 only: force HTTP failure.
      if (q.indexOf('doc2') !== -1 && q.indexOf('doc1') === -1) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end('internal error');
        return;
      }

      // Chunk for doc1 only: valid JSON payload.
      if (q.indexOf('doc1') !== -1 && q.indexOf('doc2') === -1) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(solrBody('doc1'));
        return;
      }

      res.statusCode = 404;
      res.end('');
    });

    server.listen(0, '127.0.0.1', function () {
      resolve(server);
    });
    server.on('error', reject);
  });
}

/**
 * Node-friendly JSONP substitute: performs an HTTP GET and parses the JSON body.
 * Matches the response shape that httpClient.jsonp() returns: { data, status, statusText }.
 */
function nodeJsonpRequest(url, _config) {
  var parsed = new URL(url);

  return new Promise(function (resolve, reject) {
    http
      .get(parsed.href, function (res) {
        var body = '';
        res.on('data', function (chunk) {
          body += chunk;
        });
        res.on('end', function () {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve({ data: JSON.parse(body), status: res.statusCode, statusText: 'OK' });
            } catch (_e) {
              reject({ data: null, status: res.statusCode, statusText: 'parse error' });
            }
          } else {
            reject({ data: body, status: res.statusCode, statusText: res.statusMessage || '' });
          }
        });
      })
      .on('error', function () {
        reject({ data: null, status: 0, statusText: '' });
      });
  });
}

async function main() {
  var server = await startMockSolrServer();
  var port = server.address().port;
  var origin = 'http://127.0.0.1:' + port;

  try {
    var httpClient = createFetchClient({ jsonpRequest: nodeJsonpRequest });
    var docResolverSvc = getDocResolverSvc(httpClient);
    var fieldSpecSvc = getFieldSpecSvc();

    var settings = {
      searchUrl: origin + '/solr/collection1/select',
      createFieldSpec: function () {
        return fieldSpecSvc.createFieldSpec('id field');
      },
    };

    var resolver = docResolverSvc.createResolver(['doc1', 'doc2'], settings, 1);

    var fulfilled = false;
    var rejection = null;

    try {
      await resolver.fetchDocs();
      fulfilled = true;
    } catch (err) {
      rejection = err;
    }

    assert.strictEqual(fulfilled, false, 'fetchDocs should reject when a chunk fails');
    assert.notStrictEqual(rejection, null, 'expected rejection reason from failed chunk');
  } finally {
    server.close();
  }
}

main()
  .then(function () {
    console.log('chunked-resolver-fetch.integration: OK');
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });

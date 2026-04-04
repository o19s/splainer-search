'use strict';

/**
 * Integration test: chunked docResolver Solr fetches use real $http JSONP against a local TCP
 * server (no angular-mocks $httpBackend). Verifies that when one chunk’s request fails, the
 * combined promise rejects ($q.all propagation).
 *
 * Run: npm run test:integration
 *
 * Requires: npm install (devDependency jsdom).
 */

var fs = require('fs');
var http = require('http');
var path = require('path');
var assert = require('assert');

var root = path.join(__dirname, '..', '..');

function loadScript(window, filePath) {
  var code = fs.readFileSync(filePath, 'utf8');
  // Strip ESM export keywords so eval() (script context) doesn't throw.
  // Source files use `export function ...` / `export var ...` during the ESM migration.
  code = code.replace(/^export\s+/gm, '');
  window.eval(code + '\n//# sourceURL=' + path.basename(filePath));
}

/** Same ordering as karma.conf.js: module, services/*.js, factories/*.js, values/*.js */
function librarySourceFiles() {
  var files = [path.join(root, 'module.js')];
  ['services', 'factories', 'values'].forEach(function (dir) {
    var d = path.join(root, dir);
    if (!fs.existsSync(d)) {
      return;
    }
    fs.readdirSync(d)
      .filter(function (f) {
        return f.slice(-3) === '.js';
      })
      .sort()
      .forEach(function (f) {
        files.push(path.join(d, f));
      });
  });
  return files;
}

function startMockSolrJsonpServer() {
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

      var cb = u.searchParams.get('json.wrf') || 'angular.callbacks._0';

      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');

      function solrBody(id) {
        return JSON.stringify({
          response: { numFound: 1, docs: [{ id: id, field: 't' }] },
          responseHeader: { status: 0, params: {} },
        });
      }

      // Chunk for doc2 only: force HTTP failure (JSONP script error → $http rejects).
      if (q.indexOf('doc2') !== -1 && q.indexOf('doc1') === -1) {
        res.statusCode = 500;
        res.end('internal error');
        return;
      }

      // Chunk for doc1 only: valid JSONP payload.
      if (q.indexOf('doc1') !== -1 && q.indexOf('doc2') === -1) {
        res.statusCode = 200;
        res.end(cb + '(' + solrBody('doc1') + ');');
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

function main() {
  var JSDOM;
  try {
    JSDOM = require('jsdom').JSDOM;
  } catch (_e) {
    console.error('Missing jsdom. Run: npm install');
    process.exit(1);
  }

  return startMockSolrJsonpServer().then(function (server) {
    var port = server.address().port;
    var origin = 'http://127.0.0.1:' + port;

    var VirtualConsole = require('jsdom').VirtualConsole;
    var virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', function () {
      /* Expected: 500 JSONP response surfaces as jsdom script load error. */
    });

    var dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: origin + '/',
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      virtualConsole: virtualConsole,
    });

    var window = dom.window;

    loadScript(window, path.join(root, 'node_modules', 'angular', 'angular.js'));
    loadScript(window, path.join(root, 'node_modules', 'urijs', 'src', 'URI.min.js'));

    librarySourceFiles().forEach(function (f) {
      loadScript(window, f);
    });

    window.angular.bootstrap(window.document.body, ['o19s.splainer-search']);

    var inj = window.angular.element(window.document.body).injector();
    var docResolverSvc = inj.get('docResolverSvc');
    var fieldSpecSvc = inj.get('fieldSpecSvc');
    var $rootScope = inj.get('$rootScope');

    var settings = {
      searchUrl: origin + '/solr/collection1/select',
      createFieldSpec: function () {
        return fieldSpecSvc.createFieldSpec('id field');
      },
    };

    var resolver = docResolverSvc.createResolver(['doc1', 'doc2'], settings, 1);

    var fulfilled = false;
    var rejection = null;

    resolver.fetchDocs().then(
      function () {
        fulfilled = true;
      },
      function (err) {
        rejection = err;
      }
    );

    var deadline = Date.now() + 15000;
    return new Promise(function (resolve, reject) {
      function tick() {
        try {
          $rootScope.$digest();
        } catch (digErr) {
          server.close();
          reject(digErr);
          return;
        }

        if (fulfilled || rejection !== null) {
          server.close();
          try {
            assert.strictEqual(fulfilled, false, 'fetchDocs should reject when a chunk fails');
            assert.notStrictEqual(rejection, null, 'expected rejection reason from failed chunk');
          } catch (assertErr) {
            reject(assertErr);
            return;
          }
          resolve();
          return;
        }

        if (Date.now() > deadline) {
          server.close();
          reject(new Error('Timeout waiting for chunked JSONP (jsdom may not have executed JSONP)'));
          return;
        }

        setImmediate(tick);
      }

      tick();
    });
  });
}

main()
  .then(function () {
    console.log('chunked-resolver-fetch.integration: OK');
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });

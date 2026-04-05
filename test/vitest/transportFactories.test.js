import { describe, it, expect, vi } from 'vitest';
import { createFetchClient } from '../../services/httpClient.js';
import { TransportFactory } from '../../factories/transportFactory.js';
import { HttpGetTransportFactory } from '../../factories/httpGetTransportFactory.js';
import { HttpPostTransportFactory } from '../../factories/httpPostTransportFactory.js';
import { HttpJsonpTransportFactory } from '../../factories/httpJsonpTransportFactory.js';

/**
 * Vitest tests for the three HTTP transport factories, exercised with
 * createFetchClient (no Angular DI).
 */

function mockFetch(status, body) {
  var bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  var isOk = status >= 200 && status < 300;
  return vi.fn().mockResolvedValue({
    ok: isOk,
    status: status,
    statusText: isOk ? 'OK' : 'Error',
    text: function () { return Promise.resolve(bodyText); },
  });
}

// Build a real TransportFactory constructor, then pass it + httpClient to each factory.
// Extra args (e.g. $sce for JSONP) are forwarded.
function buildTransport(FactoryFn, httpClient) {
  var BaseTransport = TransportFactory();
  var extraArgs = Array.prototype.slice.call(arguments, 2);
  return FactoryFn.apply(null, [BaseTransport, httpClient].concat(extraArgs));
}

describe('HttpGetTransportFactory', function () {
  it('issues a GET request and resolves with response data', async function () {
    var fetchFn = mockFetch(200, { hits: [] });
    var client = createFetchClient({ fetch: fetchFn });
    var Transport = buildTransport(HttpGetTransportFactory, client);
    var transport = new Transport();

    var result = await transport.query('http://example.com/search', {}, {});

    expect(result.data).toEqual({ hits: [] });
    expect(result.status).toBe(200);
    expect(fetchFn.mock.calls[0][1].method).toBe('GET');
  });

  it('passes headers and ignores payload for GET', async function () {
    var fetchFn = mockFetch(200, {});
    var client = createFetchClient({ fetch: fetchFn });
    var Transport = buildTransport(HttpGetTransportFactory, client);
    var transport = new Transport();
    var headers = { 'X-Api-Key': 'secret' };

    await transport.query('http://example.com/api', { ignored: true }, headers);

    var callArgs = fetchFn.mock.calls[0][1];
    expect(callArgs.headers).toEqual(headers);
    expect(callArgs.body).toBeUndefined();
  });

  it('rejects on HTTP error', async function () {
    var fetchFn = mockFetch(500, { error: 'fail' });
    var client = createFetchClient({ fetch: fetchFn });
    var Transport = buildTransport(HttpGetTransportFactory, client);
    var transport = new Transport();

    await expect(transport.query('http://example.com/api', {}, {}))
      .rejects.toEqual({ data: { error: 'fail' }, status: 500, statusText: 'Error' });
  });

  it('stores options passed to constructor', function () {
    var fetchFn = mockFetch(200, {});
    var client = createFetchClient({ fetch: fetchFn });
    var Transport = buildTransport(HttpGetTransportFactory, client);
    var transport = new Transport({ apiMethod: 'GET', custom: true });

    expect(transport.options()).toEqual({ apiMethod: 'GET', custom: true });
  });

  it('inherits from TransportFactory (has options method)', function () {
    var fetchFn = mockFetch(200, {});
    var client = createFetchClient({ fetch: fetchFn });
    var Transport = buildTransport(HttpGetTransportFactory, client);
    var transport = new Transport({ test: 1 });

    expect(typeof transport.options).toBe('function');
    expect(transport.options()).toEqual({ test: 1 });
  });
});

describe('HttpPostTransportFactory', function () {
  it('issues a POST request with JSON body', async function () {
    var fetchFn = mockFetch(200, { result: 'ok' });
    var client = createFetchClient({ fetch: fetchFn });
    var Transport = buildTransport(HttpPostTransportFactory, client);
    var transport = new Transport();
    var payload = { query: { match_all: {} } };

    var result = await transport.query('http://example.com/search', payload, {});

    expect(result.data).toEqual({ result: 'ok' });
    expect(fetchFn.mock.calls[0][1].method).toBe('POST');
    expect(fetchFn.mock.calls[0][1].body).toBe(JSON.stringify(payload));
  });

  it('passes custom headers', async function () {
    var fetchFn = mockFetch(200, {});
    var client = createFetchClient({ fetch: fetchFn });
    var Transport = buildTransport(HttpPostTransportFactory, client);
    var transport = new Transport();
    var headers = { 'Content-Type': 'application/json', 'X-Api-Key': 'key' };

    await transport.query('http://example.com/search', {}, headers);

    expect(fetchFn.mock.calls[0][1].headers).toEqual(headers);
  });

  it('rejects on HTTP error', async function () {
    var fetchFn = mockFetch(403, { error: 'forbidden' });
    var client = createFetchClient({ fetch: fetchFn });
    var Transport = buildTransport(HttpPostTransportFactory, client);
    var transport = new Transport();

    await expect(transport.query('http://example.com/search', {}, {}))
      .rejects.toEqual({ data: { error: 'forbidden' }, status: 403, statusText: 'Error' });
  });

  it('stores options passed to constructor', function () {
    var fetchFn = mockFetch(200, {});
    var client = createFetchClient({ fetch: fetchFn });
    var Transport = buildTransport(HttpPostTransportFactory, client);
    var transport = new Transport({ apiMethod: 'POST', timeout: 5000 });

    expect(transport.options()).toEqual({ apiMethod: 'POST', timeout: 5000 });
  });

  it('inherits from TransportFactory (has options method)', function () {
    var fetchFn = mockFetch(200, {});
    var client = createFetchClient({ fetch: fetchFn });
    var Transport = buildTransport(HttpPostTransportFactory, client);
    var transport = new Transport({});

    expect(typeof transport.options).toBe('function');
  });
});

describe('HttpJsonpTransportFactory', function () {
  it('calls httpClient.jsonp with the URL and callback param config', async function () {
    var jsonpSpy = vi.fn().mockResolvedValue({
      data: { response: { docs: [] } },
      status: 200,
      statusText: 'OK',
    });
    var client = createFetchClient({
      fetch: function () { throw new Error('fetch should not be called'); },
      jsonpRequest: jsonpSpy,
    });
    var Transport = buildTransport(HttpJsonpTransportFactory, client, null);
    var transport = new Transport();

    var result = await transport.query('http://solr.example.com/select?q=*:*', {}, {});

    expect(result.data).toEqual({ response: { docs: [] } });
    expect(jsonpSpy).toHaveBeenCalledWith(
      'http://solr.example.com/select?q=*:*',
      { jsonpCallbackParam: 'json.wrf' }
    );
  });

  it('embeds Basic auth credentials in the URL', async function () {
    var jsonpSpy = vi.fn().mockResolvedValue({
      data: {},
      status: 200,
      statusText: 'OK',
    });
    var client = createFetchClient({
      fetch: function () { throw new Error('fetch should not be called'); },
      jsonpRequest: jsonpSpy,
    });
    var Transport = buildTransport(HttpJsonpTransportFactory, client, null);
    var transport = new Transport();
    var headers = { Authorization: 'Basic ' + btoa('admin:secret/w') };

    await transport.query('https://search.example.com/solr/select', {}, headers);

    var calledUrl = jsonpSpy.mock.calls[0][0];
    var expectedPrefix = 'https://admin:' + encodeURIComponent('secret/w') + '@search.example.com/solr/select';
    expect(calledUrl).toBe(expectedPrefix);
  });

  it('does not modify URL when no Authorization header', async function () {
    var jsonpSpy = vi.fn().mockResolvedValue({
      data: {},
      status: 200,
      statusText: 'OK',
    });
    var client = createFetchClient({
      fetch: function () { throw new Error('fetch should not be called'); },
      jsonpRequest: jsonpSpy,
    });
    var Transport = buildTransport(HttpJsonpTransportFactory, client, null);
    var transport = new Transport();

    await transport.query('https://example.com/solr/select', {}, {});

    expect(jsonpSpy.mock.calls[0][0]).toBe('https://example.com/solr/select');
  });
});

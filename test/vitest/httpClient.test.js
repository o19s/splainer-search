import { describe, it, expect, vi } from 'vitest';
import { createFetchClient } from '../../services/httpClient.js';

/**
 * Tests for createFetchClient — the fetch-based HTTP client that must match
 * Angular $http's response contract: { data, status, statusText }.
 */

function mockFetch(status, body, statusText) {
  var bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  var isOk = status >= 200 && status < 300;
  return vi.fn().mockResolvedValue({
    ok: isOk,
    status: status,
    statusText: statusText || (isOk ? 'OK' : 'Error'),
    text: function () {
      return Promise.resolve(bodyText);
    },
  });
}

function networkErrorFetch() {
  return vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
}

describe('createFetchClient', function () {
  describe('get()', function () {
    it('resolves with { data, status, statusText } on 200', async function () {
      var fetchFn = mockFetch(200, { hits: [] });
      var client = createFetchClient(fetchFn);

      var result = await client.get('http://example.com/search', { headers: {} });

      expect(result.data).toEqual({ hits: [] });
      expect(result.status).toBe(200);
      expect(result.statusText).toBe('OK');
    });

    it('sends GET method and headers', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient(fetchFn);
      var headers = { 'X-Api-Key': 'secret' };

      await client.get('http://example.com/api', { headers: headers });

      expect(fetchFn).toHaveBeenCalledWith('http://example.com/api', {
        method: 'GET',
        headers: headers,
      });
    });

    it('does not include a body for GET requests', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient(fetchFn);

      await client.get('http://example.com/api', { headers: {} });

      var callArgs = fetchFn.mock.calls[0][1];
      expect(callArgs.body).toBeUndefined();
    });
  });

  describe('post()', function () {
    it('resolves with { data, status, statusText } on 200', async function () {
      var fetchFn = mockFetch(200, { result: 'ok' });
      var client = createFetchClient(fetchFn);

      var result = await client.post('http://example.com/search', { query: 'test' }, { headers: {} });

      expect(result.data).toEqual({ result: 'ok' });
      expect(result.status).toBe(200);
    });

    it('sends POST method with JSON body', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient(fetchFn);
      var payload = { query: { match_all: {} } };

      await client.post('http://example.com/search', payload, { headers: {} });

      expect(fetchFn).toHaveBeenCalledWith('http://example.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        body: JSON.stringify(payload),
      });
    });

    it('defaults Content-Type to application/json on POST when caller omits it', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient(fetchFn);

      await client.post('http://example.com/_search', { q: 1 });

      var callArgs = fetchFn.mock.calls[0][1];
      expect(callArgs.headers['Content-Type']).toBe('application/json;charset=utf-8');
    });

    it('preserves caller-supplied Content-Type (case-insensitive) on POST', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient(fetchFn);

      await client.post('http://example.com/x', 'a=1&b=2', {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });

      var headers = fetchFn.mock.calls[0][1].headers;
      expect(headers['content-type']).toBe('application/x-www-form-urlencoded');
      expect(headers['Content-Type']).toBeUndefined();
    });

    it('does not mutate the caller-supplied headers object', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient(fetchFn);
      var sharedHeaders = {};

      await client.post('http://example.com/x', { a: 1 }, { headers: sharedHeaders });

      expect(sharedHeaders).toEqual({});
    });

    it('sends string body without re-stringifying', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient(fetchFn);
      var rawBody = '{}\n{}\n';

      await client.post('http://example.com/_msearch', rawBody, { headers: {} });

      var callArgs = fetchFn.mock.calls[0][1];
      expect(callArgs.body).toBe(rawBody);
    });

    it('handles null payload (no body sent)', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient(fetchFn);

      await client.post('http://example.com/search', null, { headers: {} });

      var callArgs = fetchFn.mock.calls[0][1];
      expect(callArgs.body).toBeUndefined();
    });
  });

  describe('error responses (4xx/5xx)', function () {
    it('rejects with { data, status, statusText } on 4xx', async function () {
      var fetchFn = mockFetch(403, { error: 'forbidden' }, 'Forbidden');
      var client = createFetchClient(fetchFn);

      await expect(client.get('http://example.com/api', { headers: {} }))
        .rejects.toEqual({
          data: { error: 'forbidden' },
          status: 403,
          statusText: 'Forbidden',
        });
    });

    it('rejects with { data, status, statusText } on 5xx', async function () {
      var fetchFn = mockFetch(500, { error: 'internal' }, 'Internal Server Error');
      var client = createFetchClient(fetchFn);

      await expect(client.post('http://example.com/api', {}, { headers: {} }))
        .rejects.toEqual({
          data: { error: 'internal' },
          status: 500,
          statusText: 'Internal Server Error',
        });
    });

    it('rejection object is mutable (callers add searchError)', async function () {
      expect.assertions(2);
      var fetchFn = mockFetch(500, { error: 'fail' }, 'Error');
      var client = createFetchClient(fetchFn);

      try {
        await client.get('http://example.com/api', { headers: {} });
      } catch (err) {
        err.searchError = 'Custom error message';
        expect(err.searchError).toBe('Custom error message');
        expect(err.status).toBe(500);
      }
    });
  });

  describe('network errors', function () {
    it('rejects with status 0 on network failure', async function () {
      var fetchFn = networkErrorFetch();
      var client = createFetchClient(fetchFn);

      await expect(client.get('http://unreachable.example.com', { headers: {} }))
        .rejects.toMatchObject({
          data: null,
          status: 0,
          statusText: '',
        });
    });

    it('preserves the original error as `cause` for debugging', async function () {
      var underlying = new TypeError('Failed to fetch');
      var fetchFn = function () { return Promise.reject(underlying); };
      var client = createFetchClient(fetchFn);

      await expect(client.get('http://unreachable.example.com', { headers: {} }))
        .rejects.toMatchObject({ cause: underlying });
    });
  });

  describe('JSON parsing', function () {
    it('parses valid JSON response body', async function () {
      var fetchFn = mockFetch(200, { key: 'value' });
      var client = createFetchClient(fetchFn);

      var result = await client.get('http://example.com/api', { headers: {} });
      expect(result.data).toEqual({ key: 'value' });
    });

    it('returns raw text when response is not valid JSON', async function () {
      var badText = '<html>not json</html>';
      var fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: function () {
          return Promise.resolve(badText);
        },
      });
      var client = createFetchClient(fetchFn);

      var result = await client.get('http://example.com/api', { headers: {} });
      expect(result.data).toBe(badText);
    });

    it('returns null for empty response body', async function () {
      var fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: function () {
          return Promise.resolve('');
        },
      });
      var client = createFetchClient(fetchFn);

      var result = await client.get('http://example.com/api', { headers: {} });
      expect(result.data).toBeNull();
    });
  });

  describe('jsonp()', function () {
    it('uses custom jsonpRequest when provided', async function () {
      var jsonpSpy = vi.fn().mockResolvedValue({
        data: { response: { docs: [] } },
        status: 200,
        statusText: 'OK',
      });
      var client = createFetchClient({ jsonpRequest: jsonpSpy });

      var result = await client.jsonp('http://example.com/solr/select?q=*:*', {
        jsonpCallbackParam: 'json.wrf',
      });

      expect(result.data).toEqual({ response: { docs: [] } });
      expect(jsonpSpy).toHaveBeenCalledWith('http://example.com/solr/select?q=*:*', {
        jsonpCallbackParam: 'json.wrf',
      });
    });

    it('uses script injection when no jsonpRequest override is provided', async function () {
      // Mock the DOM APIs needed for script tag injection
      var mockHead = {
        appendChild: vi.fn(function (script) {
          // Simulate the server invoking the callback
          var callbackName = new URL(script.src).searchParams.get('callback');
          globalThis[callbackName]({ response: { docs: ['a'] } });
        }),
        removeChild: vi.fn(),
      };
      var hadDocument = 'document' in globalThis;
      var origDocument = globalThis.document;

      globalThis.document = {
        head: mockHead,
        createElement: function (tag) {
          if (tag === 'script') {
            return { parentNode: mockHead, removeChild: vi.fn() };
          }
        },
      };

      try {
        var client = createFetchClient({ fetch: vi.fn() });
        var result = await client.jsonp('http://example.com/solr/select?q=*:*', {
          jsonpCallbackParam: 'callback',
        });

        expect(result.data).toEqual({ response: { docs: ['a'] } });
        expect(result.status).toBe(200);
        expect(mockHead.appendChild).toHaveBeenCalled();
      } finally {
        if (hadDocument) {
          globalThis.document = origDocument;
        } else {
          delete globalThis.document;
        }
      }
    });

    it('rejects with AbortError when signal is already aborted', async function () {
      var client = createFetchClient({ fetch: vi.fn() });
      var ac = new AbortController();
      ac.abort();

      await expect(
        client.jsonp('http://example.com/solr/select?q=*:*', {
          jsonpCallbackParam: 'callback',
          signal: ac.signal,
        }),
      ).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('rejects with AbortError when signal aborts after script is added', async function () {
      var mockHead = {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      };
      var scriptStub = { parentNode: mockHead, src: '' };
      var hadDocument = 'document' in globalThis;
      var origDocument = globalThis.document;

      globalThis.document = {
        head: mockHead,
        createElement: function (tag) {
          if (tag === 'script') {
            return scriptStub;
          }
        },
      };

      try {
        var client = createFetchClient({ fetch: vi.fn() });
        var ac = new AbortController();
        var p = client.jsonp('http://example.com/solr/select?q=*:*', {
          jsonpCallbackParam: 'callback',
          signal: ac.signal,
        });
        ac.abort();
        await expect(p).rejects.toMatchObject({ name: 'AbortError' });
        expect(mockHead.removeChild).toHaveBeenCalled();
      } finally {
        if (hadDocument) {
          globalThis.document = origDocument;
        } else {
          delete globalThis.document;
        }
      }
    });
  });

  describe('defaults', function () {
    it('uses empty headers when config has no headers', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient(fetchFn);

      await client.get('http://example.com/api');

      var callArgs = fetchFn.mock.calls[0][1];
      expect(callArgs.headers).toEqual({});
    });
  });

  describe('AbortSignal (GET/POST)', function () {
    it('passes signal from config to fetch for get', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient(fetchFn);
      var ac = new AbortController();

      await client.get('http://example.com/api', { headers: {}, signal: ac.signal });

      expect(fetchFn.mock.calls[0][1].signal).toBe(ac.signal);
    });

    it('passes signal from config to fetch for post', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient(fetchFn);
      var ac = new AbortController();

      await client.post('http://example.com/api', { a: 1 }, { headers: {}, signal: ac.signal });

      expect(fetchFn.mock.calls[0][1].signal).toBe(ac.signal);
    });

    it('uses default signal from createFetchClient when request omits it', async function () {
      var fetchFn = mockFetch(200, {});
      var ac = new AbortController();
      var client = createFetchClient({ fetch: fetchFn, signal: ac.signal });

      await client.get('http://example.com/api', { headers: {} });

      expect(fetchFn.mock.calls[0][1].signal).toBe(ac.signal);
    });

    it('per-request signal overrides createFetchClient default', async function () {
      var fetchFn = mockFetch(200, {});
      var defaultAc = new AbortController();
      var reqAc = new AbortController();
      var client = createFetchClient({ fetch: fetchFn, signal: defaultAc.signal });

      await client.get('http://example.com/api', { headers: {}, signal: reqAc.signal });

      expect(fetchFn.mock.calls[0][1].signal).toBe(reqAc.signal);
    });

    it('propagates AbortError from fetch without wrapping', async function () {
      var abortErr =
        typeof DOMException !== 'undefined'
          ? new DOMException('Aborted', 'AbortError')
          : Object.assign(new Error('Aborted'), { name: 'AbortError' });
      var fetchFn = vi.fn().mockRejectedValue(abortErr);
      var client = createFetchClient(fetchFn);

      await expect(client.get('http://example.com/api', { headers: {} })).rejects.toBe(abortErr);
    });
  });

  describe('credentials (GET/POST)', function () {
    it('omits credentials from fetch options when not configured', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient(fetchFn);

      await client.get('http://example.com/api', { headers: {} });

      expect(fetchFn.mock.calls[0][1]).not.toHaveProperty('credentials');
    });

    it('applies default credentials from createFetchClient options', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient({ fetch: fetchFn, credentials: 'include' });

      await client.get('http://example.com/api', { headers: {} });
      await client.post('http://example.com/api', { a: 1 }, { headers: {} });

      expect(fetchFn.mock.calls[0][1].credentials).toBe('include');
      expect(fetchFn.mock.calls[1][1].credentials).toBe('include');
    });

    it('lets per-request config.credentials override the default', async function () {
      var fetchFn = mockFetch(200, {});
      var client = createFetchClient({ fetch: fetchFn, credentials: 'include' });

      await client.get('http://example.com/api', { headers: {}, credentials: 'omit' });

      expect(fetchFn.mock.calls[0][1].credentials).toBe('omit');
    });
  });
});

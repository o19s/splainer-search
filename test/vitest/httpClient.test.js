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
        headers: {},
        body: JSON.stringify(payload),
      });
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
        .rejects.toEqual({
          data: null,
          status: 0,
          statusText: '',
        });
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
    it('issues a GET request (JSONP via fetch fallback)', async function () {
      var fetchFn = mockFetch(200, { response: { docs: [] } });
      var client = createFetchClient(fetchFn);

      var result = await client.jsonp('http://example.com/solr/select?q=*:*', {});

      expect(result.data).toEqual({ response: { docs: [] } });
      expect(fetchFn.mock.calls[0][1].method).toBe('GET');
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
});

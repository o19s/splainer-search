'use strict';

/*jslint latedef:false*/

/**
 * Headers for Elasticsearch `_msearch` (NDJSON) POST bodies.
 * Sets `Content-Type: application/x-ndjson` when the caller did not supply
 * any Content-Type (case-insensitive), matching ES multi-search requirements.
 *
 * @param {Object} [incoming]
 * @returns {Object}
 */
function headersForMsearchBody(incoming) {
  var h = Object.assign({}, incoming);
  var hasContentType = Object.keys(h).some(function (key) {
    return key.toLowerCase() === 'content-type';
  });
  if (!hasContentType) {
    h['Content-Type'] = 'application/x-ndjson';
  }
  return h;
}

/**
 * True when `data` looks like an Elasticsearch `_msearch` JSON body: a plain object
 * with a `responses` array whose length matches the number of in-flight queries in
 * this batch (the queue may already hold newly enqueued items for the next batch).
 *
 * @param {*} data - `httpResp.data` from the POST
 * @param {number} expectedResponseCount - number of `inFlight` entries for this POST
 * @returns {boolean}
 */
function isSaneMsearchBody(data, expectedResponseCount) {
  if (data === null || data === undefined) {
    return false;
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }
  if (!Object.hasOwn(data, 'responses')) {
    return false;
  }
  if (!Array.isArray(data.responses)) {
    return false;
  }
  if (data.responses.length !== expectedResponseCount) {
    return false;
  }
  return true;
}

export function BulkTransportFactory(TransportFactory, httpClient, utilsSvc) {
  var Transport = function (options) {
    TransportFactory.call(this, options);
    this.batchSender = null;
  };

  Transport.prototype = Object.create(TransportFactory.prototype);
  Transport.prototype.constructor = Transport;

  Transport.prototype.query = query;

  var BatchSender = function (url, headers) {
    /* Use Elasticsearch's _msearch API to send
     * batches of searches one batch at a time
     * */

    var requestConfig = { headers: headersForMsearchBody(headers) };
    var self = this;
    self.enqueue = enqueue;
    self.url = getUrl;
    var queue = [];
    var pendingHttp = null;

    function finishBatch(batchSize) {
      pendingHttp = null;
      queue = queue.slice(batchSize);
    }

    function countInFlight() {
      var n = 0;
      utilsSvc.safeForEach(queue, function (pendingQuery) {
        if (pendingQuery.inFlight) {
          n++;
        }
      });
      return n;
    }

    function multiSearchSuccess(httpResp) {
      var bulkHttpResp = httpResp && httpResp.data;
      var batchSize = countInFlight();
      if (!isSaneMsearchBody(bulkHttpResp, batchSize)) {
        multiSearchFailed(bulkHttpResp !== undefined ? bulkHttpResp : httpResp);
        return;
      }
      dequeuePendingSearches(bulkHttpResp);
      finishBatch(bulkHttpResp.responses.length);
    }

    function multiSearchFailed(bulkHttpResp) {
      // Handle HTTP failure, which should fail all in flight searches
      var numInFlight = 0;
      utilsSvc.safeForEach(queue, function (pendingQuery) {
        if (pendingQuery.inFlight) {
          pendingQuery.reject(bulkHttpResp);
          numInFlight++;
        }
      });
      finishBatch(numInFlight);
    }

    function buildMultiSearch() {
      // Batch queued searches into one message using MultiSearch API
      // https://www.elastic.co/guide/en/elasticsearch/reference/1.4/search-multi-search.html
      var sharedHeader = JSON.stringify({});
      var queryLines = [];
      utilsSvc.safeForEach(queue, function (pendingQuery) {
        queryLines.push(sharedHeader);
        pendingQuery.inFlight = true;
        queryLines.push(JSON.stringify(pendingQuery.payload));
      });
      var data = queryLines.join('\n') + '\n';
      return data;
    }

    function dequeuePendingSearches(bulkHttpResp) {
      // Examine the responses and dequeue the corresponding
      // searches
      var queueIdx = 0;
      utilsSvc.safeForEach(bulkHttpResp.responses, function (resp) {
        var currRequest = queue[queueIdx];
        if (
          resp !== null &&
          resp !== undefined &&
          typeof resp === 'object' &&
          Object.hasOwn(resp, 'error')
        ) {
          currRequest.reject(resp);
          // individual query failure
        } else {
          // make the response look like standard response
          currRequest.resolve({ data: resp });
        }

        queueIdx++;
      });
    }

    function sendMultiSearch() {
      if (!pendingHttp && queue.length > 0) {
        // Implementation of Elasticsearch's _msearch ("Multi Search") API
        var payload = buildMultiSearch();
        pendingHttp = httpClient.post(url, payload, requestConfig);
        pendingHttp
          .then(multiSearchSuccess, multiSearchFailed)
          .catch(function (err) {
            console.debug('Failed to do multi search');
            multiSearchFailed(err);
          });
      }
    }

    function enqueue(query) {
      var resolve, reject;
      var promise = new Promise(function (res, rej) {
        resolve = res;
        reject = rej;
      });

      var pendingQuery = {
        resolve: resolve,
        reject: reject,
        inFlight: false,
        payload: query,
      };
      queue.push(pendingQuery);
      ensureTimer();
      return promise;
    }

    var timerId = null;

    function timerTick() {
      sendMultiSearch();
      if (queue.length > 0) {
        timerId = setTimeout(timerTick, 100);
      } else {
        timerId = null;
      }
    }

    function ensureTimer() {
      if (timerId === null) {
        timerId = setTimeout(timerTick, 100);
      }
    }

    /**
     * Stops the batching timer only. Any `httpClient.post` already in flight is not
     * aborted; when it settles, `multiSearchSuccess` / `multiSearchFailed` still run
     * on this BatchSender’s closure.
     */
    function cancel() {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    }

    self.cancel = cancel;

    function getUrl() {
      return url;
    }
  };

  function query(url, payload, headers) {
    var self = this;
    if (!self.batchSender) {
      self.batchSender = new BatchSender(url, headers);
    } else if (self.batchSender.url() !== url) {
      self.batchSender.cancel();
      self.batchSender = new BatchSender(url, headers);
    }
    return self.batchSender.enqueue(payload);
  }

  return Transport;
}


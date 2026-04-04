'use strict';

/*jslint latedef:false*/

export function BulkTransportFactory(TransportFactory, $http, $q, $timeout, $log, utilsSvc) {
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

    var requestConfig = { headers: headers };
    var self = this;
    self.enqueue = enqueue;
    self.url = getUrl;
    var queue = [];
    var pendingHttp = null;

    function finishBatch(batchSize) {
      pendingHttp = null;
      queue = queue.slice(batchSize);
    }

    function multiSearchSuccess(httpResp) {
      // Examine the responses and dequeue the corresponding
      // searches
      var bulkHttpResp = httpResp.data;
      if (Object.hasOwn(bulkHttpResp, 'responses')) {
        var respLen = bulkHttpResp.responses.length;
        dequeuePendingSearches(bulkHttpResp);
        finishBatch(respLen);
      } else {
        multiSearchFailed(bulkHttpResp);
      }
    }

    function multiSearchFailed(bulkHttpResp) {
      // Handle HTTP failure, which should fail all in flight searches
      var numInFlight = 0;
      utilsSvc.safeForEach(queue, function (pendingQuery) {
        if (pendingQuery.inFlight) {
          pendingQuery.deferred.reject(bulkHttpResp);
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
        if (Object.hasOwn(resp, 'error')) {
          currRequest.deferred.reject(resp);
          // individual query failure
        } else {
          // make the response look like standard response
          currRequest.deferred.resolve({ data: resp });
        }

        queueIdx++;
      });
    }

    function sendMultiSearch() {
      if (!pendingHttp && queue.length > 0) {
        // Implementation of Elasticsearch's _msearch ("Multi Search") API
        var payload = buildMultiSearch();
        pendingHttp = $http.post(url, payload, requestConfig);
        pendingHttp.then(multiSearchSuccess, multiSearchFailed).catch(function (response) {
          $log.debug('Failed to do multi search');
          return $q.reject(response);
        });
      }
    }

    function enqueue(query) {
      var deferred = $q.defer();

      var pendingQuery = {
        deferred: deferred,
        inFlight: false,
        payload: query,
      };
      queue.push(pendingQuery);
      ensureTimer();
      return deferred.promise;
    }

    var timerPromise = null;

    function timerTick() {
      sendMultiSearch();
      if (queue.length > 0) {
        timerPromise = $timeout(timerTick, 100);
      } else {
        timerPromise = null;
      }
    }

    function ensureTimer() {
      if (!timerPromise) {
        timerPromise = $timeout(timerTick, 100);
      }
    }

    function cancel() {
      if (timerPromise) {
        $timeout.cancel(timerPromise);
        timerPromise = null;
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

// Angular DI registration (removed in Phase 4)
if (typeof angular !== 'undefined') {
  angular
    .module('o19s.splainer-search')
    .factory('BulkTransportFactory', [
      'TransportFactory',
      '$http',
      '$q',
      '$timeout',
      '$log',
      'utilsSvc',
      BulkTransportFactory,
    ]);
}

'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('BulkTransportFactory', [
      'TransportFactory',
      '$http',
      '$q',
      '$timeout',
      BulkTransportFactory
    ]);


  function BulkTransportFactory(TransportFactory, $http, $q, $timeout) {
    var Transport = function(options) {
      TransportFactory.call(this, options);
      this.batchSender = null;
    };

    Transport.prototype = Object.create(TransportFactory.prototype);
    Transport.prototype.constructor = Transport;

    Transport.prototype.query = query;



    var BatchSender = function(url, headers) {
      /* Use Elasticsearch's _msearch API to send
       * batches of searches one batch at a time
       * */

      var requestConfig = {headers: headers};
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
        if (bulkHttpResp.hasOwnProperty('responses'))  {
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
        angular.forEach(queue, function(pendingQuery) {
          if (pendingQuery.inFlight) {
            pendingQuery.defered.reject(bulkHttpResp);
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
        angular.forEach(queue, function(pendingQuery) {
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
        angular.forEach(bulkHttpResp.responses, function(resp) {
          var currRequest = queue[queueIdx];
          if (resp.hasOwnProperty('error')) {
            currRequest.defered.reject(resp);
            // individual query failure
          } else {
            // make the response look like standard response
            currRequest.defered.resolve({'data': resp});
          }

          queueIdx++;
        });
      }

      function sendMultiSearch() {
        if (!pendingHttp && queue.length > 0) {
          // Implementation of Elasticsearch's _msearch ("Multi Search") API
          var payload = buildMultiSearch();
          pendingHttp = $http.post(url, payload, requestConfig);
          pendingHttp.then(multiSearchSuccess, multiSearchFailed);
        }
      }

      function enqueue(query) {
        var defered = $q.defer();

        var pendingQuery = {
          defered: defered,
          inFlight: false,
          payload: query,
        };
        queue.push(pendingQuery);
        return defered.promise;
      }

      function timerTick() {
        sendMultiSearch();
        $timeout(timerTick, 100);
      }

      function getUrl() {
        return url;
      }

      $timeout(timerTick, 100);


    };

    function query(url, payload, headers) {
      var self = this;
      if (!self.batchSender) {
        self.batchSender = new BatchSender(url, headers);
      }
      else if (self.batchSender.url() !== url) {
        self.batchSender = new BatchSender(url, headers);
      }
      return self.batchSender.enqueue(payload);

    }

    return Transport;
  }
})();

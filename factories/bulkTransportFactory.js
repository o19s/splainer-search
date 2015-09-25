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
    var BulkTransporter = function(url, headers) {

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

      function dequeue(httpResp) {
        var bulkHttpResp = httpResp.data;
        if (bulkHttpResp.hasOwnProperty('responses'))  {
          var queueIdx = 0;
          var respLen = bulkHttpResp.responses.length;
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
          finishBatch(respLen);
        } else {
          allFailed(bulkHttpResp);
        }
      }

      function allFailed(bulkHttpResp) {
        var numInFlight = 0;
        angular.forEach(queue, function(pendingQuery) {
          if (pendingQuery.inFlight) {
            pendingQuery.defered.reject(bulkHttpResp);
            // fail them
            numInFlight++;
          }
        });
        finishBatch(numInFlight);
      }

      function tryHttp() {
        if (!pendingHttp && queue.length > 0) {
          // Implementation of Elasticsearch's _msearch ("Multi Search") API
          var sharedHeader = JSON.stringify({}); // means use inde
          var queryLines = [];
          angular.forEach(queue, function(pendingQuery) {
            queryLines.push(sharedHeader);
            pendingQuery.inFlight = true;
            queryLines.push(JSON.stringify(pendingQuery.payload));
          });
          var data = queryLines.join('\n');
          pendingHttp = $http.post(url, data + '\n', requestConfig);
          pendingHttp.then(dequeue, allFailed);
        }
      }

      function enqueue(payload) {
        var defered = $q.defer();

        var pendingQuery = {
          defered: defered,
          inFlight: false,
          payload: payload,
        };
        queue.push(pendingQuery);
        return defered.promise;
      }

      function timerTick() {
        tryHttp();
        $timeout(timerTick, 100);
      }

      function getUrl() {
        return url;
      }

      $timeout(timerTick, 100);


    };

    var Transport = function(options) {
      TransportFactory.call(this, options);
      this.bulkTransporter = null;
    };

    Transport.prototype = Object.create(TransportFactory.prototype);
    Transport.prototype.constructor = Transport;

    Transport.prototype.query = query;

    function query(url, payload, headers) {
      var self = this;
      if (!self.bulkTransporter) {
        self.bulkTransporter = new BulkTransporter(url, headers);
      }
      else if (self.bulkTransporter.url() !== url) {
        self.bulkTransporter = new BulkTransporter(url, headers);
      }
      return self.bulkTransporter.enqueue(payload);

    }

    return Transport;
  }
})();

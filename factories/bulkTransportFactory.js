'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('HttpPostTransportFactory', [
      'TransportFactory',
      '$http',
      HttpPostTransportFactory
    ]);


  function HttpPostTransportFactory(TransportFactory, $http, $q, $timeout) {
    var BulkTransporter = function(url, headers) {

      var requestConfig = {headers: headers};
      var self = this;
      self.enqueue = enqueue;
      var queue = [];
      var pendingHttp = null;

      function dequeue(bulkHttpResp) {
        if (bulkHttpResp.hasOwnProperty('responses'))  {
          var queueIdx = 0;
          var respLen = bulkHttpResp.responses.length;
          angular.forEach(bulkHttpResp.responses, function(resp) {
            if (resp.hasOwnProperty('error')) {
              currRequest.defered.reject(resp);
              // individual query failure
            } else {
              var currRequest = queue[queueIdx];
              currRequest.defered.resolve(resp);
            }

            queueIdx++;
          });
          queue.slice(respLen);
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
        queue.slice(numInFlight);
      }

      function tryHttp() {
        if (!pendingHttp) {
          // Implementation of Elasticsearch's _msearch ("Multi Search") API
          var sharedHeader = {}; // means use inde
          var queryLines = [];
          angular.forEach(queue, function(pendingQuery) {
            queryLines.push(sharedHeader);
            pendingQuery.inFlight = true;
            queryLines.push(pendingQuery.payload);
          });
          var data = '\n'.join(queryLines);
          pendingHttp = $http.post(url, data, requestConfig);
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
        $timeout(100, timerTick);
      }

      $timeout(100, timerTick);


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
      return self.bulkTransporter.enqueue(payload);

    }

    return Transport;
  }
})();

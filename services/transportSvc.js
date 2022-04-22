'use strict';

angular.module('o19s.splainer-search')
  .service('transportSvc', [
    'HttpPostTransportFactory',
    'HttpGetTransportFactory',
    'HttpJsonpTransportFactory',
    'BulkTransportFactory',
    function transportSvc(
      HttpPostTransportFactory,
      HttpGetTransportFactory,
      HttpJsonpTransportFactory,
      BulkTransportFactory
    ) {
      var self = this;

      // functions
      self.getTransport = getTransport;

      var bulkTransport     = new BulkTransportFactory({});
      var httpPostTransport = new HttpPostTransportFactory({});
      var httpGetTransport  = new HttpGetTransportFactory({});
      var httpJsonpTransport  = new HttpJsonpTransportFactory({});

      function getTransport(options) {
        var apiMethod = options.apiMethod;
        if (apiMethod !== undefined) {
          apiMethod = apiMethod.toUpperCase();
        }

        if (apiMethod === 'BULK') {
          return bulkTransport;
        } else if (apiMethod === 'JSONP') {
          return httpJsonpTransport;
        } else if (apiMethod === 'GET') {
          return httpGetTransport;
        } else {
          return httpPostTransport;
        }
      }
    }
  ]);

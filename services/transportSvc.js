'use strict';

angular.module('o19s.splainer-search')
  .service('transportSvc', [
    'HttpPostTransportFactory',
    'HttpGetTransportFactory',
    'HttpJsonpTransportFactory',
    'BulkTransportFactory',
    'HttpProxyTransportFactory',
    function transportSvc(
      HttpPostTransportFactory,
      HttpGetTransportFactory,
      HttpJsonpTransportFactory,
      BulkTransportFactory,
      HttpProxyTransportFactory
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
        let transport = null;
        if (apiMethod === 'BULK') {
          transport = bulkTransport;
        } else if (apiMethod === 'JSONP') {
          transport = httpJsonpTransport;
        } else if (apiMethod === 'GET') {
          transport = httpGetTransport;
        } else {
          transport = httpPostTransport;
        }
      
        var proxyUrl = options.proxyUrl; 
        if (proxyUrl !== undefined) {
          console.log("creating Proxy")
          transport = new HttpProxyTransportFactory({proxyUrl: proxyUrl, transport: transport});
          //transport = proxyTransport;
        }
        return transport;
      }
    }
  ]);

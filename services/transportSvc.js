'use strict';

angular.module('o19s.splainer-search')
  .service('transportSvc', function transportSvc(HttpPostTransportFactory, BulkTransportFactory) {
    var self = this;
    self.getTransport = getTransport;
    var bulkTransport = new BulkTransportFactory({});
    var httpPostTransport = new HttpPostTransportFactory({});

    function getTransport(options) {
      if (options.searchApi === 'bulk') {
        return bulkTransport;
      }
      return httpPostTransport;
    }
  });

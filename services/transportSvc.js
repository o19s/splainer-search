'use strict';

angular.module('o19s.splainer-search')
  .service('transportSvc', function transportSvc(HttpPostTransportFactory, BulkTransportFactory) {
    var self = this;
    self.getTransport = getTransport;

    function getTransport(options) {
      if (options.searchApi === 'bulk') {
        return new BulkTransportFactory(options);
      }
      return new HttpPostTransportFactory(options);
    }
  });

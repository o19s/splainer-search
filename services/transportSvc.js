'use strict';

angular.module('o19s.splainer-search')
  .service('transportSvc', function transportSvc(HttpPostTransportFactory) {
    var self = this;
    self.getTransport = getTransport;

    function getTransport(options) {
      return new HttpPostTransportFactory(options);
    }
  });

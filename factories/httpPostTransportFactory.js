'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('HttpPostTransportFactory', [
      'TransportFactory',
      '$http',
      HttpPostTransportFactory
    ]);

  function HttpPostTransportFactory(TransportFactory, $http) {
    var Transport = function(options) {
      TransportFactory.call(this, options);
    };

    Transport.prototype = Object.create(TransportFactory.prototype);
    Transport.prototype.constructor = Transport;

    Transport.prototype.query = query;

    function query(url, payload, headers) {
      var requestConfig = {headers: headers};
      return $http.post(url, payload, requestConfig);
    }

    return Transport;
  }
})();

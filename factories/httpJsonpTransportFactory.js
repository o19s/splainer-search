'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('HttpJsonpTransportFactory', [
      'TransportFactory',
      '$http',
      HttpJsonpTransportFactory
    ]);

  function HttpJsonpTransportFactory(TransportFactory, $http) {
    var Transport = function(options) {
      TransportFactory.call(this, options);
    };

    Transport.prototype = Object.create(TransportFactory.prototype);
    Transport.prototype.constructor = Transport;

    Transport.prototype.query = query;

    function query(url, payload, headers) {
      // you don't get header or payload support with jsonp, it's akin to GET requests that way.
      return $http.jsonp(url, { jsonpCallbackParam: 'json.wrf' });
    }

    return Transport;
  }
})();

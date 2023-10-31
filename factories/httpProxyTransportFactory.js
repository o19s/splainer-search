'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('HttpProxyTransportFactory', [
      'TransportFactory',
      '$http',
      'HttpJsonpTransportFactory',
      HttpProxyTransportFactory
    ]);

  function HttpProxyTransportFactory(TransportFactory, $http, HttpJsonpTransportFactory) {
    var Transport = function(options) {
      console.log("HELLLO")
      TransportFactory.call(this, options);
    };

    Transport.prototype = Object.create(TransportFactory.prototype);
    Transport.prototype.constructor = Transport;

    Transport.prototype.query = query;

    function query(url, payload, headers) {
      console.log("ABOUT TO QUERY")
      console.log(this.options())
      var transport = this.options().transport;
      console.log(typeof transport);
      
      // JSONP doesn't like two ? in the URL.
      if (transport instanceof HttpJsonpTransportFactory) {
        console.log("replace")
        url = url.replace('?','%3F');
      }
      var url = this.options().proxyUrl + url;
      return transport.query(url, payload, headers);
    }

    return Transport;
  }
})();

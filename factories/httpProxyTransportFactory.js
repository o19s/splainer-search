'use strict';

/*jslint latedef:false*/

export function HttpProxyTransportFactory(TransportFactory, HttpJsonpTransportFactory) {
  var Transport = function (options) {
    TransportFactory.call(this, options);
  };

  Transport.prototype = Object.create(TransportFactory.prototype);
  Transport.prototype.constructor = Transport;

  Transport.prototype.query = query;

  function query(url, payload, headers) {
    var transport = this.options().transport;

    // It doesn't make sense to use JSONP instead of GET with a proxy
    if (transport instanceof HttpJsonpTransportFactory) {
      throw new Error('It does not make sense to proxy a JSONP connection, use GET instead.');
    }
    url = this.options().proxyUrl + url;
    return transport.query(url, payload, headers);
  }

  return Transport;
}

// Angular DI registration (removed in Phase 4)
if (typeof angular !== 'undefined') {
  angular
    .module('o19s.splainer-search')
    .factory('HttpProxyTransportFactory', [
      'TransportFactory',
      'HttpJsonpTransportFactory',
      HttpProxyTransportFactory,
    ]);
}

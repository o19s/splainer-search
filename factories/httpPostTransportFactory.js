'use strict';

/*jslint latedef:false*/

export function HttpPostTransportFactory(TransportFactory, httpClient) {
  var Transport = function (options) {
    TransportFactory.call(this, options);
  };

  Transport.prototype = Object.create(TransportFactory.prototype);
  Transport.prototype.constructor = Transport;

  Transport.prototype.query = query;

  function query(url, payload, headers) {
    var requestConfig = { headers: headers };
    return httpClient.post(url, payload, requestConfig);
  }

  return Transport;
}


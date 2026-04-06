'use strict';

/*jslint latedef:false*/

/**
 * JSONP transport delegating to `httpClient.jsonp` (no Angular `$sce`).
 *
 * @param {Function} TransportFactory - Base transport constructor.
 * @param {{ jsonp: function(string, Object): Promise }} httpClient - Client with `.jsonp(url, config)`; `url` must be a string.
 */
export function HttpJsonpTransportFactory(TransportFactory, httpClient) {
  var Transport = function (options) {
    TransportFactory.call(this, options);
  };

  Transport.prototype = Object.create(TransportFactory.prototype);
  Transport.prototype.constructor = Transport;

  Transport.prototype.query = query;

  function query(url, payload, headers) {
    // JSONP doesn't support headers, so we need to encode the user password in the URL.
    // Special characters need to be encoded.
    if (headers && headers['Authorization']) {
      var creds = headers['Authorization'].replace('Basic ', '');
      creds = atob(creds);
      // Split only on the first ':' so passwords may contain ':' (RFC 2617 userpass).
      var colon = creds.indexOf(':');
      var user = colon === -1 ? creds : creds.slice(0, colon);
      var pass = colon === -1 ? '' : creds.slice(colon + 1);
      var userPassword = user + ':' + encodeURIComponent(pass);

      url = url.replace('://', '://' + userPassword + '@');
    }

    // you don't get header or payload support with jsonp, it's akin to GET requests that way.
    return httpClient.jsonp(url, { jsonpCallbackParam: 'json.wrf' });
  }

  return Transport;
}


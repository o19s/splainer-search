'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('HttpJsonpTransportFactory', [
      'TransportFactory',
      '$http','$sce',
      HttpJsonpTransportFactory
    ]);

  function HttpJsonpTransportFactory(TransportFactory, $http, $sce) {
    var Transport = function(options) {
      TransportFactory.call(this, options);
    };

    Transport.prototype = Object.create(TransportFactory.prototype);
    Transport.prototype.constructor = Transport;

    Transport.prototype.query = query;

    function query(url, payload, headers) {
      
      // JSONP doesn't support headers, so we need to encode the user password in the URL. 
      // Special characters need to be encoded. 
      if (headers && headers['Authorization']) {
        let userPassword = headers['Authorization'];
        userPassword = userPassword.replace('Basic ', '');
        userPassword = atob(userPassword);
        userPassword = userPassword.split(':');
        userPassword = userPassword[0] + ':' + encodeURIComponent(userPassword[1]);

        url = url.replace('://', '://' + userPassword + '@');
      }
      
      url = $sce.trustAsResourceUrl(url);
      
      // you don't get header or payload support with jsonp, it's akin to GET requests that way.
      return $http.jsonp(url, { jsonpCallbackParam: 'json.wrf' });
    }

    return Transport;
  }
})();

'use strict';

angular.module('o19s.splainer-search')
  .service('vectaraUrlSvc', [

    function vectaraUrlSvc() {
      // no real URL manipulation required, all requests go to a fixed endpoint

      const self      = this;
      self.getHeaders = getHeaders;

      function getHeaders(customHeaders) {
        var headers = {};
        customHeaders = customHeaders || '';

        if (customHeaders.length > 0) {
          headers = JSON.parse(customHeaders);
        }

        return headers;
      }

    }
  ]);

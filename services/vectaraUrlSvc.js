'use strict';

angular.module('o19s.splainer-search')
  .service('vectaraUrlSvc', [
    'customHeadersJson',

    function vectaraUrlSvc(customHeadersJson) {
      // no real URL manipulation required, all requests go to a fixed endpoint

      const self      = this;
      self.getHeaders = getHeaders;

      function getHeaders(customHeaders) {
        var headers = {};
        customHeaders = customHeaders || '';

        if (customHeaders.length > 0) {
          var parsed = customHeadersJson.tryParseObject(customHeaders);
          headers = parsed.ok ? parsed.headers : {};
        }

        return headers;
      }

    }
  ]);

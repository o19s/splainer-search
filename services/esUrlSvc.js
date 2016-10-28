'use strict';

/*global URI*/
angular.module('o19s.splainer-search')
  .service('esUrlSvc', [
    function esUrlSvc() {

      var self      = this;

      self.parseUrl         = parseUrl;
      self.buildDocUrl      = buildDocUrl;
      self.buildExplainUrl  = buildExplainUrl;
      self.buildUrl         = buildUrl;
      self.buildBaseUrl     = buildBaseUrl;
      self.setParams        = setParams;
      self.getHeaders       = getHeaders;
      self.isBulkCall       = isBulkCall;

      /**
       *
       * private method fixURLProtocol
       * Adds 'http://' to the beginning of the URL if no protocol was specified.
       *
       */
      var protocolRegex = /^https{0,1}\:/;
      function fixURLProtocol(url) {
        if (!protocolRegex.test(url)) {
          url = 'http://' + url;
        }
        return url;
      }

      /**
       *
       * Parses an ES URL of the form [http|https]://[username@password:][host][:port]/[collectionName]/_search
       * Splits up the different parts of the URL.
       *
       */
      function parseUrl (url) {
        url = fixURLProtocol(url);
        var a = new URI(url);

        var esUri = {
          protocol: a.protocol(),
          host:     a.host(),
          pathname: a.pathname(),
          username: a.username(),
          password: a.password(),
          query:    a.query(),
        };

        if (esUri.pathname.endsWith('/')) {
          esUri.pathname = esUri.pathname.substring(0, esUri.pathname.length - 1);
        }

        return esUri;
      }

      /**
       *
       * Builds ES URL of the form [protocol]://[host][:port]/[index]/[type]/[id]
       * for an ES document.
       *
       */
      function buildDocUrl (uri, doc) {
        var index = doc._index;
        var type  = doc._type;
        var id    = doc._id;

        var url = self.buildBaseUrl(uri);
        url = url + '/' + index + '/' + type + '/' + id;

        return url;
      }


      /**
       *
       * Builds ES URL of the form [protocol]://[host][:port]/[index]/[type]/[id]/_explain
       * for an ES document.
       *
       */
      function buildExplainUrl (uri, doc) {
        var docUrl = self.buildDocUrl(uri, doc);

        var url = docUrl + '/_explain';

        return url;
      }

      /**
       *
       * Builds ES URL for a search query.
       * Adds any query params if present: /_search?from=10&size=10
       */
      function buildUrl (uri) {
        var self = this;

        var url = self.buildBaseUrl(uri);
        url = url + uri.pathname;

        // Return original URL if no params to append.
        if ( angular.isUndefined(uri.params) && angular.isUndefined(uri.query) ) {
          return url;
        }

        var paramsAsStrings = [];

        angular.forEach(uri.params, function(value, key) {
          paramsAsStrings.push(key + '=' + value);
        });

        if ( angular.isDefined(uri.query) && uri.query !== '' ) {
          paramsAsStrings.push(uri.query);
        }

        // Return original URL if no params to append.
        if ( paramsAsStrings.length === 0 ) {
          return url;
        }

        var finalUrl = url;

        if (finalUrl.substring(finalUrl.length - 1) === '?') {
          finalUrl += paramsAsStrings.join('&');
        } else {
          finalUrl += '?' + paramsAsStrings.join('&');
        }

        return finalUrl;
      }

      function buildBaseUrl (uri) {
        var url = uri.protocol + '://';
        if (uri.password && uri.username) {
          url += uri.username + ':' + uri.password + '@';
        }
        url += (uri.host);

        return url;
      }

      function setParams (uri, params) {
        uri.params = params;
      }

      function getHeaders (uri) {
        var headers = {};

        if ( angular.isDefined(uri.username) && uri.username !== '' &&
          angular.isDefined(uri.password) && uri.password !== '') {
          var authorization = 'Basic ' + btoa(uri.username + ':' + uri.password);
          headers = { 'Authorization': authorization };
        }

        return headers;
      }

      function isBulkCall (uri) {
        return uri.pathname.endsWith('_msearch');
      }
    }
  ]);

'use strict';

angular.module('o19s.splainer-search')
  .service('esUrlSvc', function esUrlSvc() {

    var self      = this;

    self.protocol = null;
    self.host     = null;
    self.pathname = null;
    self.username = null;
    self.password = null;

    self.parsed   = null;
    self.params   = null;

    self.parseUrl     = parseUrl;
    self.buildDocUrl  = buildDocUrl;
    self.buildUrl     = buildUrl;
    self.buildBaseUrl = buildBaseUrl;
    self.setParams    = setParams;

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
      url = a;

      self.protocol = a.protocol();
      self.host     = a.host();
      self.pathname = a.pathname();
      self.username = a.username();
      self.password = a.password();

      self.parsed   = true;
    };

    /**
     *
     * Builds ES URL of the form [protocol]://[host][:port]/[index]/[type]/[id]
     * for an ES document.
     *
     */
    function buildDocUrl (doc) {
      var index = doc._index;
      var type  = doc._type;
      var id    = doc._id;

      var url = self.buildBaseUrl();
      url = url + '/' + index + '/' + type + '/' + id;

      return url;
    }

    /**
     *
     * Builds ES URL for a search query.
     * Adds any query params if present: /_search?from=10&size=10
     */
    function buildUrl () {
      var self = this;

      var url = self.buildBaseUrl();
      url = url + self.pathname;

      // Return original URL if no params to append.
      if ( angular.isUndefined(self.params) ) {
        return url;
      }

      var paramsAsStrings = [];

      angular.forEach(self.params, function(value, key) {
        paramsAsStrings.push(key + '=' + value);
      });

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

    function buildBaseUrl() {
      if (!self.parsed) {
        throw new UrlNotParseException();
      }

      var url = self.protocol + '://' + self.host;

      return url
    }

    function setParams (params) {
      var self    = this;
      self.params = params;
    }

    function UrlNotParseException() {
       var self = this;
       self.message = "URL not parsed. Must call the parse() function first.";
       self.toString = function() {
          return self.message;
       };
    }
  });

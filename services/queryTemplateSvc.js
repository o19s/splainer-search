'use strict';

angular.module('o19s.splainer-search')
  .service('queryTemplateSvc', function queryTemplateSvc() {
    var self      = this;
    self.hydrate = hydrate;

    var defaultConfig = {
      encodeURI: true
    };

    function encode(queryPart, config) {
      if (config.encodeURI) {
        return encodeURIComponent(queryPart);
      } else {
        return queryPart;
      }
    }

    function hydrate(template, queryText, config) {
      if (!config) {
        config = defaultConfig;
      }

      //var queryTerms    = queryText.split(/[ ,]+/);
      var replaced  = template.replace(/#\$query##/g, encode(queryText, config));
      console.log(replaced);
      return replaced;
    }
  });

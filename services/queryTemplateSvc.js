'use strict';

angular.module('o19s.splainer-search')
  .service('queryTemplateSvc', function queryTemplateSvc() {
    var self      = this;
    self.hydrate = hydrate;

    var defaultConfig = {
      encodeURI: false,
      defaultKw: '""',
    };

    function encode(queryPart, config) {
      if (config.encodeURI) {
        return encodeURIComponent(queryPart);
      } else {
        return queryPart;
      }
    }


    function keywordMapping(queryText) {
      var queryTerms    = queryText.split(/[ ,]+/);
      var maxKeywords = 10;
      var numTerms = queryTerms.length;
      for (var i = numTerms; i < maxKeywords; i++) {
        queryTerms.push(null);
      }
      return queryTerms;
    }

    function hydrate(template, queryText, config) {
      if (!config) {
        config = defaultConfig;
      }

      if (queryText === null || angular.isUndefined(queryText)) {
        return template;
      }

      var replaced  = template.replace(/#\$query##/g, encode(queryText, config));
      var idx = 0;
      angular.forEach(keywordMapping(queryText), function(queryTerm) {
        var regex = new RegExp('#\\$keyword' + (idx + 1) + '##', 'g');
        if (queryTerm === null) {
          queryTerm = config.defaultKw;
        } else {
          queryTerm = encode(queryTerm, config);
        }
        replaced = replaced.replace(regex, queryTerm);
        idx += 1;
      });
      return replaced;
    }
  });

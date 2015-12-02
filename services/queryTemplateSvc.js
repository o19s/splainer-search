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

    function getMaxKeywords(template) {
      var keywordMatch = /#\$keyword(\d)##/g;
      var match = keywordMatch.exec(template);
      var maxKw = 0;
      while (match !== null) {
        var kwNum = parseInt(match[1]);
        if (kwNum) {
          if (kwNum > maxKw) {
            maxKw = kwNum;
          }
        }
        match = keywordMatch.exec(template);
      }
      return maxKw;
    }

    function keywordMapping(queryText, maxKeywords) {
      var queryTerms    = queryText.split(/[ ,]+/);
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
      var maxKeywords = getMaxKeywords(template);
      angular.forEach(keywordMapping(queryText, maxKeywords), function(queryTerm) {
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

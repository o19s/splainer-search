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

    function getKeywordDefaults(template, config) {
      var keywordMatch = /#\$keyword(\d)(\|.*?){0,1}##/g;
      var match = keywordMatch.exec(template);
      var maxKw = 0;
      var defaults = [];
      while (match !== null) {
        var kwNum = parseInt(match[1]);
        if (kwNum) {
          if (kwNum > maxKw) {
            maxKw = kwNum;
          }
        }
        var def = match[2];
        if (def) {
          defaults[kwNum] = def.slice(1);
        }
        else {
          defaults[kwNum] = config.defaultKw;
        }
        match = keywordMatch.exec(template);
      }
      return defaults;
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
      var defaults = getKeywordDefaults(template, config);
      var maxKeywords = defaults.length;
      angular.forEach(keywordMapping(queryText, maxKeywords), function(queryTerm) {
        var regex = new RegExp('#\\$keyword' + (idx + 1) + '(.*?)##', 'g');
        var def = defaults[idx + 1];
        if (angular.isUndefined(def)) {
          def = config.defaultKw;
        }
        if (queryTerm === null) {
          queryTerm = def;
        } else {
          queryTerm = encode(queryTerm, config);
        }
        replaced = replaced.replace(regex, queryTerm);
        idx += 1;
      });
      return replaced;
    }
  });

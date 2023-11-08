'use strict';

// There is some innovative parsing going on here around #$keyword[1]##,
// however that logic isn't documented in Quepid or Splainer.
// I think it's a pointer to a the idea that you might want to define "experiments" that
// take in a query and do innovative things with it, like rework the order of the query terms and see happens
// that leverages the splainer-search infrastructure.   This though, at least as implmented feels too limited.
// So you can pluck out keywords..  so what..  I think we need a lot more tooling to make it useful.  - Eric.
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

    function getMaxKws(template) {
      var keywordMatch = /#\$keyword\d|(.*?)##/g;
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

    function hydrateWithKwDefaults(replaced, config) {
      // Though its possible this link gets out of link, this was the origin
      // of the regex below
      // http://www.regexpal.com/?fam=93576
      replaced = replaced.replace(/#\$keyword\d\|(.*?)##/g, '$1'); // regex
      // anything left, use config defaults
      replaced = replaced.replace(/#\$keyword\d(\|(.*?)){0,1}##/g, config.defaultKw); // regex
      return replaced;
    }

    function hydrateWithKws(replaced, queryText, maxKws, config) {
      var idx = 0;
      angular.forEach(keywordMapping(queryText, maxKws), function(queryTerm) {
        var regex = new RegExp('#\\$keyword' + (idx + 1) + '(.*?)##', 'g');
        if (queryTerm !== null) {
          queryTerm = encode(queryTerm, config);
          replaced = replaced.replace(regex, queryTerm);
        }
        idx += 1;
      });
      return replaced;
    }

    function hydrate(template, queryText, config) {
      if (!config) {
        config = defaultConfig;
      }

      if (queryText === null || angular.isUndefined(queryText)) {
        return template;
      }

      var replaced  = template.replace(/#\$query##/g, encode(queryText, config));
      var maxKws = getMaxKws(template, config);
      replaced = hydrateWithKws(replaced, queryText, maxKws, config);
      replaced = hydrateWithKwDefaults(replaced, config);

      return replaced;
    }
  });

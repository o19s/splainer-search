'use strict';

angular.module('o19s.splainer-search')
  .service('solrUrlSvc', [
    function solrUrlSvc() {

      /* private method fixURLProtocol
       * add 'http://' to the begining of the url if no protocol was
       * specified
       * */
      var protocolRegex = /^https{0,1}\:/;
      function fixURLProtocol(url) {
        if (!protocolRegex.test(url)) {
          url = 'http://' + url;
        }
        return url;
      }
      this.buildUrl = function(url, urlArgs) {
        url = fixURLProtocol(url);
        var baseUrl = url + '?';
        baseUrl += this.formatSolrArgs(urlArgs);
        return baseUrl;
      };

      /* Given arguments of the form {q: ['*:*'], fq: ['title:foo', 'text:bar']}
       * turn into string suitable for URL query param q=*:*&fq=title:foo&fq=text:bar
       *
       * */
      this.formatSolrArgs = function(argsObj) {
        var rVal = '';
        angular.forEach(argsObj, function(values, param) {
          angular.forEach(values, function(value) {
            rVal += param + '=' + value + '&';
          });
        });
        // percentages need to be escaped before
        // url escaping
        rVal = rVal.replace(/%/g, '%25');
        return rVal.slice(0, -1); // take out last & or trailing ? if no args
      };

      /* Given string of the form [?]q=*:*&fq=title:foo&fq=title:bar
       * turn into object of the form:
       * {q:['*:*'], fq:['title:foo', 'title:bar']}
       *
       * */
      this.parseSolrArgs = function(argsStr) {
        var splitUp = argsStr.split('?');
        if (splitUp.length === 2) {
          argsStr = splitUp[1];
        }
        var vars = argsStr.split('&');
        var rVal = {};
        angular.forEach(vars, function(qVar) {
          var nameAndValue = qVar.split('=');
          if (nameAndValue.length >= 2) {
            var name = nameAndValue[0];
            var value = nameAndValue.slice(1).join('=');
            var decodedValue = decodeURIComponent(value);
            if (!rVal.hasOwnProperty(name)) {
              rVal[name] = [decodedValue];
            } else {
              rVal[name].push(decodedValue);
            }
          }
        });
        return rVal;
      };

      /* Parse a Solr URL of the form [/]solr/[collectionName]/[requestHandler]
       * return object with {collectionName: <collectionName>, requestHandler: <requestHandler>}
       * return null on failure to parse as above solr url
       * */
      this.parseSolrPath = function(pathStr) {
        if (pathStr.startsWith('/')) {
          pathStr = pathStr.slice(1);
        }

        var pathComponents = pathStr.split('/');
        var pcLen = pathComponents.length;
        if (pcLen >= 2) {

          var reqHandler = pathComponents[pcLen - 1];
          var collection = pathComponents[pcLen - 2];
          return {requestHandler: reqHandler, collectionName: collection};
        }
        return null;
      };

      /* Parse a Sor URL of the form [http|https]://[host]/solr/[collectionName]/[requestHandler]?[args]
       * return null on failure to parse
       * */
      this.parseSolrUrl = function(solrReq) {
        solrReq = fixURLProtocol(solrReq);
        var parseUrl = function(url) {
          // this is the crazy way you parse URLs in JS who am I to question the wisdom
          var a = document.createElement('a');
          a.href = url;
          return a;
        };

        var parsedUrl = parseUrl(solrReq);
        parsedUrl.solrArgs = this.parseSolrArgs(parsedUrl.search);
        var pathParsed = this.parseSolrPath(parsedUrl.pathname);
        if (pathParsed) {
          parsedUrl.collectionName = pathParsed.collectionName;
          parsedUrl.requestHandler = pathParsed.requestHandler;
        } else {
          return null;
        }
        var solrEndpoint = function() {
          return parsedUrl.protocol + '//' + parsedUrl.host + parsedUrl.pathname;
        };

        parsedUrl.solrEndpoint = solrEndpoint;
        return parsedUrl;

      };

      /*optionally escape user query text, ie
       * q=punctuation:: clearly can't search for the
       * term ":" (colon) because colon has meaning in the query syntax
       * so instead, you've got to search for
       * q=punctuation:\:
       * */
      this.escapeUserQuery = function(queryText) {
        var escapeChars = ['+', '-', '&', '!', '(', ')', '[', ']',
                           '{', '}', '^', '"', '~', '*', '?', ':', '\\'];
        var regexp = new RegExp('(\\' + escapeChars.join('|\\') + ')', 'g');
        var symsRepl = queryText.replace(regexp, '\\$1');
        var regexpAnd = new RegExp('(^|\\s+)(and)($|\\s+)', 'g');
        var andRepl = symsRepl.replace(regexpAnd, '$1\\\\$2$3');
        var regexOr = new RegExp('(^|\\s+)(or)($|\\s+)', 'g');
        var orRepl = andRepl.replace(regexOr, '$1\\\\$2$3');
        return orRepl;
      };

      /* This method is a bit tied to how the searchSvc behaves, but
       * as this module is probably what you're using to chop up a user's SolrURL
       * its placed here
       *
       * It strips arguments out that are not supported by searchSvc and
       * generally interfere with its operation (ie fl, rows, etc). searchSvc
       * removes these itself, but this is placed here for convenience to remove
       * from user input (ie an fl may confuse the user when fl is actually supplied
       * elsewhere)
       * */
      this.removeUnsupported = function(solrArgs) {
          var warnings = {};
          // Stuff I think we can safely remove without warning the user
          delete solrArgs['json.wrf'];
          delete solrArgs.facet;
          delete solrArgs['facet.field'];
          delete solrArgs.fl;
          delete solrArgs.hl;
          delete solrArgs['hl.simple.pre'];
          delete solrArgs['hl.simple.post'];
          delete solrArgs.wt;
          delete solrArgs.rows;
          delete solrArgs.debug;

          // Unsupported stuff to remove and provide a friendly warning
          return warnings;
      };
    }
  ]);

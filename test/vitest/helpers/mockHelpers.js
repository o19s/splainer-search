/**
 * ESM versions of test/mock/mockHelpers.js (Karma globals).
 */

export function parseUrlParams(queryString) {
  if (queryString[0] === '?') {
    queryString = queryString.slice(1, queryString.length);
  }
  var queryParams = queryString.split('&');
  var parsedParams = {};
  queryParams.forEach(function(queryParam) {
    var qpSplit = queryParam.split(/=(.*)/);
    var param = qpSplit[0];
    var value = qpSplit[1];
    if (!Object.hasOwn(parsedParams, param)) {
      parsedParams[param] = [];
    }
    parsedParams[param].push(value);
  });
  return parsedParams;
}

export function arrayContains(list, value) {
  if (!list) { return false; }
  return list.indexOf(value) !== -1;
}

export function urlContainsParams(url, params) {
  return {
    test: function(requestedUrl) {
      if (requestedUrl.indexOf(url) !== 0) { return false; }
      var missingParam = false;
      var urlEncodedArgs = requestedUrl.substr(url.length);
      var parsedParams = parseUrlParams(urlEncodedArgs);
      if (params) {
        Object.keys(params).forEach(function(param) {
          var values = params[param];
          if (values instanceof Array) {
            values.forEach(function(value) {
              if (!arrayContains(parsedParams[param], value)) {
                missingParam = true;
              }
            });
          } else {
            missingParam = true;
          }
        });
      }
      return !missingParam;
    }
  };
}

export function urlMissingParams(url, params) {
  return {
    test: function(requestedUrl) {
      if (requestedUrl.indexOf(url) !== 0) { return false; }
      var found = false;
      var urlEncodedArgs = requestedUrl.substr(url.length);
      var parsedParams = parseUrlParams(urlEncodedArgs);
      if (params) {
        Object.keys(params).forEach(function(param) {
          var values = params[param];
          if (values instanceof Array) {
            values.forEach(function(value) {
              if (arrayContains(parsedParams[param], value)) {
                found = true;
              }
            });
          }
        });
      }
      return !found;
    }
  };
}

export function urlHasBasicAuth() {
  return {
    test: function(requestedUrl) {
      try {
        var uri = new URL(requestedUrl);
        return uri.username !== '' && uri.password !== '';
      } catch (_error) {
        return false;
      }
    }
  };
}

export function urlHasNoBasicAuth() {
  return {
    test: function(requestedUrl) {
      try {
        var uri = new URL(requestedUrl);
        return uri.username === '' && uri.password === '';
      } catch (_error) {
        return false;
      }
    }
  };
}

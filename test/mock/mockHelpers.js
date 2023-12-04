'use strict';

window.parseUrlParams = function(queryString) {
  if (queryString[0] === '?') {
    queryString = queryString.slice(1, queryString.length);
  }
  var queryParams = queryString.split('&');
  var parsedParams = {};
  angular.forEach(queryParams, function(queryParam) {
    var qpSplit = queryParam.split(/=(.*)/);
    var param = qpSplit[0];
    var value = qpSplit[1];
    if (!parsedParams.hasOwnProperty(param)) {
      parsedParams[param] = [];
    }
    parsedParams[param].push(value);
  });
  return parsedParams;
};

window.urlHasNoBasicAuth = function() {
  return {
    test: function(requestedUrl) {
      try {
        const uri = new URL(requestedUrl);
        if (uri.username === '' && uri.password === ''){
          return true; 
        }
        else {
          console.error('Expected username: ' + uri.username + ' and password: ' + uri.password + ' to both be missing from url ' + requestedUrl);
          return false;
        }          
      } catch (error) {
        return false; // Invalid URL
      }      
    }
  }
}

window.arrayContains = function(list, value) {
  var contains = false;
  angular.forEach(list, function(listValue) {
    if (listValue === value) {
      contains = true;
    }
  });
  return contains;
};

window.urlContainsParams = function(url, params) {
  return {
    test: function(requestedUrl) {
      if (requestedUrl.indexOf(url) !== 0) {
        return false;
      }
      var missingParam = false;
      var urlEncodedArgs = requestedUrl.substr(url.length);
      var parsedParams = parseUrlParams(urlEncodedArgs);
      angular.forEach(params, function(values, param) {
        if (values instanceof Array) {
          angular.forEach(values, function(value) {
            if (!arrayContains(parsedParams[param], value)) {
              console.error('Expected param: ' + param + ' missing');
              missingParam = true;
            }
          });
        } else {
          missingParam = true;
        }
      });
      return !missingParam;
    }
  };
};

window.urlMissingParams = function(url, params) {
  return {
    test: function(requestedUrl) {
      if (requestedUrl.indexOf(url) !== 0) {
        return false;
      }
      var found = false;
      var urlEncodedArgs = requestedUrl.substr(url.length);
      var parsedParams = parseUrlParams(urlEncodedArgs);
      angular.forEach(params, function(values, param) {
        if (values instanceof Array) {
          angular.forEach(values, function(value) {
            if (arrayContains(parsedParams[param], value)) {
              console.error('Param: ' + param + ' should be missing, but found');
              found = true;
            }
          });
        }
      });
      return !found;
    }
  };
}

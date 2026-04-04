'use strict';

window.parseUrlParams = function(queryString) {
  if (queryString[0] === '?') {
    queryString = queryString.slice(1, queryString.length);
  }
  var queryParams = queryString.split('&');
  var parsedParams = {};
  queryParams.forEach(function(queryParam) {
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

window.urlHasBasicAuth = function() {
  return {
    test: function(requestedUrl) {
      try {
        const uri = new URL(requestedUrl);
        if (uri.username !== '' && uri.password !== ''){
          return true; 
        }
        else {
          console.error('Expected username: ' + uri.username + ' and password: ' + uri.password + ' to both be embedded in url ' + requestedUrl);
          return false;
        }          
      } catch (error) {
        return false; // Invalid URL
      }      
    }
  }
}

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
  if (!list) { return false; }
  return list.indexOf(value) !== -1;
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
      if (params) {
        Object.keys(params).forEach(function(param) {
          var values = params[param];
          if (values instanceof Array) {
            values.forEach(function(value) {
              if (!arrayContains(parsedParams[param], value)) {
                console.error('Expected param: ' + param + ' missing');
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
      if (params) {
        Object.keys(params).forEach(function(param) {
          var values = params[param];
          if (values instanceof Array) {
            values.forEach(function(value) {
              if (arrayContains(parsedParams[param], value)) {
                console.error('Param: ' + param + ' should be missing, but found');
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

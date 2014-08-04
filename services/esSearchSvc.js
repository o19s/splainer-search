'use strict';

angular.module('o19s.splainer-search')
  .service('esSearchSvc', function esSearchSvc($http) {

      //baseUrl = baseUrl.replace(/#\$query##/g, encodeURIComponent(queryText));
    var replaceQuery = function(esArgs, queryText) {
      var replaced = {};
      angular.forEach(esArgs, function(value, key) {
        if (typeof(value) === 'object') {
          replaced[key] = replaceQuery(value, queryText);
        } else if (typeof(value) === 'string') {
          replaced[key] = value.replace(/#\$query##/g, queryText);
        } else {
          replaced[key] = value;
        }
      }); 
      return replaced;
    };
  
 
    var EsSearcher = function(fieldList, esUrl, esArgs, queryText) {
    
      //TODO -- this.callUrl and this.linkUrl
      this.docs = [];
      this.numFound = 0;
      this.inError = false;

      var queryDsl = replaceQuery(esArgs, queryText);
      queryDsl.fields = fieldList;

      this.search = function() {
        this.inError = false;
        var promise = Promise.create(this.search);
        var that = this;

        $http.post(esUrl, queryDsl).success(function(data) {
          that.numFound = data.hits.total;

          angular.forEach(data.hits.hits, function(hit) {
            var doc = hit._source; 
            // TODO doc.url, doc.explain, doc.highlight
            that.docs.push(doc);
          });
          promise.complete();
        })
        .error(function() {
          that.inError = true;
          promise.complete();
        });

        return promise;
      };

    };

    this.createSearcher = function(fieldList, esUrl, esArgs, queryText) {
      return new EsSearcher(fieldList, esUrl, esArgs, queryText);
    };
  
  });

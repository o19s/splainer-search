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
      queryDsl.explain = true;

      this.search = function() {
        this.inError = false;
        var promise = Promise.create(this.search);
        var that = this;

        $http.post(esUrl, queryDsl).success(function(data) {
          that.numFound = data.hits.total;

          angular.forEach(data.hits.hits, function(hit) {
            var doc = {};
            // stringify fields
            angular.forEach(hit.fields, function(fieldValue, fieldName) {
              if (fieldValue.length === 1 && typeof(fieldValue) === 'object') {
                doc[fieldName] = fieldValue[0];
              } else {
                doc[fieldName] = fieldValue;
              }
            });

            // TODO doc.url, doc.explain, doc.highlight
            doc.explain = function() {
              if (hit.hasOwnProperty('_explanation')) {
                return hit._explanation;
              }
              else {
                return null;
              }
            };
            doc.url = function() {
              return '#';
            };
            doc.highlight = function() {
              return null;
            };
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

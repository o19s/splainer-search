'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('SearchApiSearcherFactory', [
      '$q',
      '$log',
      'VectaraDocFactory',
      'activeQueries',
      'searchApiSearcherPreprocessorSvc',
      'solrUrlSvc',
      'esUrlSvc',
      'SearcherFactory',
      'queryTemplateSvc',
      'transportSvc',      
      SearchApiSearcherFactory
    ]);

  function SearchApiSearcherFactory(
    $q, 
    $log,
    VectaraDocFactory,
    activeQueries,
    searchApiSearcherPreprocessorSvc,
    solrUrlSvc,
    esUrlSvc,
    SearcherFactory,
    queryTemplateSvc,
    transportSvc
  ) {

    var Searcher = function(options) {
      SearcherFactory.call(this, options, searchApiSearcherPreprocessorSvc);
    };

    Searcher.prototype = Object.create(SearcherFactory.prototype);
    Searcher.prototype.constructor = Searcher; // Reset the constructor

    Searcher.prototype.addDocToGroup    = addDocToGroup;
    Searcher.prototype.pager            = pager;
    Searcher.prototype.search           = search;


    function addDocToGroup (groupedBy, group, vectaraDoc) {
      /*jslint validthis:true*/
      const self = this;

      console.log("adddocToGroup")

      found.docs.push(vectaraDoc);
    }

    // return a new searcher that will give you
    // the next page upon search(). To get the subsequent
    // page, call pager on that searcher
    function pager (){
      /*jslint validthis:true*/
      console.log("Pager")
    }

    // search (execute the query) and produce results
    // to the returned future
    function search () {
      /*jslint validthis:true*/
      const self= this;
      console.log("self.config");
      console.log(self.config)
      var apiMethod = self.config.apiMethod;
      var url       = self.url;
      var uri       = esUrlSvc.parseUrl(self.url);
      var transport = transportSvc.getTransport({apiMethod: apiMethod});

      console.log("url2: " + url);
      console.log("apiMethod" + apiMethod);
      console.log("self.args:");
      console.log( self.args)
      console.log("queryText:" + self.queryText);
      
      // maybe the url and the payload should be managed inside the transport?
      // i don't like how it's not more seamless what to do on a GET and a POST
      //if (apiMethod === 'GET') {     
      //  esUrlSvc.setParams(uri, self.args);
      //}
      // i don't like that we just ignroe the payload on a GET even though it is passed in.
      var payload = self.queryDsl;
      //var baseUrl = solrUrlSvc.buildUrl(url, self.args);
      var url       = esUrlSvc.buildUrl(uri);
    
      //baseUrl = queryTemplateSvc.hydrate(baseUrl, self.queryText, {encodeURI: true, defaultKw: '""'});
      console.log("url" + url);
      self.inError  = false;

      activeQueries.count++;
      return transport.query(url, payload, null)
        .then(function success(httpConfig) {
          console.log("Hi there")
          var data = httpConfig.data;
          activeQueries.count--;

          const documents = data.responseSet && data.responseSet.length > 0 ? data.responseSet[0].document : [];

          self.numFound = documents.length;

          var parseDoc = function(doc, groupedBy, group) {
            var options = {
              groupedBy:          groupedBy,
              group:              group,
              fieldList:          self.fieldList,
              url:                self.url
            };

            return new VectaraDocFactory(doc, options);
          };

          angular.forEach(documents, function(docFromApi) {
            const doc = parseDoc(docFromApi);
            self.docs.push(doc);
          });

        }, function error(msg) {
          console.log("Error")
          activeQueries.count--;
          self.inError = true;
          msg.searchError = 'Error with Search API query or server. Review request manually.';
          return $q.reject(msg);
        })
        .catch(function(response) {
          $log.debug('Failed to execute search');
          return $q.reject(response);
        });
    } // end of search()

    // Return factory object
    return Searcher;
  }
})();

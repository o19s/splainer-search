'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('DelegateSearcherFactory', [
      '$http',
      '$q',
      'SearcherFactory',
      DelegateSearcherFactory
    ]);

  // create the delegate searcher
  function DelegateSearcherFactory(
    $http,
    $q,
    SearcherFactory
  ) {

    var Searcher = function(options) {
      console.log(options);
      SearcherFactory.call(this, options, null);
      console.log(Window.CustomSearchEngines);
      console.log(Window.CustomSearchEngines[options.searchEngine]);
      this.delegate = Window.CustomSearchEngines[options.searchEngine];
    };

    Searcher.prototype = Object.create(SearcherFactory.prototype);
    Searcher.prototype.constructor = Searcher; // Reset the constructor

    Searcher.prototype.addDocToGroup    = addDocToGroup;
    Searcher.prototype.pager            = pager;
    Searcher.prototype.search           = search;
    Searcher.prototype.explainOther     = explainOther;
    Searcher.prototype.explain          = explain;


    function addDocToGroup (groupedBy, group, doc) {
      return this.delegate.addDocToGroup(groupedBy, group, doc)
    }

    // return a new searcher that will give you
    // the next page upon search(). To get the subsequent
    // page, call pager on that searcher ad infinidum
    function pager () {
      return this.delegate.pager();
    }

    // search (execute the query) and produce results
    // to the returned future
    function search () {
      return this.delegate.search();
    } // end of search()

    function explainOther (otherQuery) {
      return this.delegate.explainOther();
    } // end of explainOther()

    function explain(doc) {
      return this.delegate.explain(doc);
    } // end of explain()

    // Return factory object
    return Searcher;
  }
})();

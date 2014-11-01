# AngularJS Search Service

[![Build Status](https://travis-ci.org/o19s/splainer-search.svg?branch=master)](https://travis-ci.org/o19s/splainer-search)

## Basic usage

    // searcher that searches body, type
    var searcher = solrSearchSvc.createSearcher(['id', 'title', 'body', 'author']',
                                                'http://localhost:8983/solr/select',
                                                {
                                                   'q': ['*:*'],
                                                   'fq': ['title:Moby*', 'author:Herman']
                                                 });
    searcher.search()
    .then(function() {
       angular.forEach(searcher.docs, function(doc) {
          console.log(doc.source().title);
          // highlights
          console.log(doc.highlight(doc.source().id, 'title', '<b>', '</b>');
          // explain info
          console.log(doc.explain(doc.source().id);
       });
    });
    
                                                  
## Paging

```
    var results = [];
    searcher.search()
    .then(function() {
       angular.forEach(searcher.docs, function(doc) {
          results.push(doc.source().title));
       });
       // once results returned, get a new searcher for the next
       // page of results, just rerun the search later exactly as
       // its run here
       searcher = searcher.pager();
    });
    
    // sometime later we page...
    searcher.search()
    .then(function() {
        ...
    });
    ```
    
    

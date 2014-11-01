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
       });
    });
                                                  

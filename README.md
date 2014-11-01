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

});
```


## Using a field spec

This library was originally written for dealing with debug tools such as [Quepid](http://quepid.com) and [Splainer](http://splainer.io). As such, it provides a lot of help taking a user specified list of fields and associated roles, then once search is done turning the raw docs out of the Solr searcher into something more normalized (a normalDoc):

```
var userFieldSpec = "id:uuid, title, body, authors"
var fs = fieldSpecSvc.createFieldSpec(userFieldSpec)
var searcher = solrSearchSvc.createSearcher(fs.fieldList(),
                                            'http://localhost:8983/solr/select',
                                            {
                                               'q': ['*:*'],
                                               'fq': ['title:Moby*', 'author:Herman']
                                             });
searcher.search()
.then(function() {
   var  bestScore = 0;
   angular.forEach(searcher.docs, function(doc) {
        var normalDoc = normalDocSvc.createNormalDoc(doc);
        // access unique id and title
        // (above specified to be uuid and title)
        console.log("ID is:" + normalDoc.id);
        console.log("Title is:" + normalDoc.id);
        
        // snippets -- best try to highlight the field
        angular.forEach(normalDoc.subSnippets, function(snippet, fieldName) {
            console.log('hopefully this is a highlight! ' + snippet);
        });
        
        // prettier and heavily sanitized explain info:
        // (the explain modal on Splainer shows this)
        console.log(normalDoc.explain());
        
        // hot matches contains the most important matches
        // for this doc
        var matches = normalDoc.hotMatches();
        
        // Give hotMatchesOutOf a maximum score (for all docs returned) and you'll 
        // get the hot matches as a percentage of thewhole
        if (normalDoc.score() > bestScore) {
           bestScore = normalDoc.score();
        }
        var normalDoc.matchesOutOf(bestScore);
        
        // a link to the document in Solr is handy:
        console.log(normalDoc.url())
    })
});

```

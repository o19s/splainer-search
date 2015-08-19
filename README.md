# AngularJS Search Service

Splainer Search is an Angular Solr Search library used in Solr relevancy tools [Quepid](http://quepid.com) and [Splainer](http://splainer.io). Its available for anyone to use (see [license](LICENSE.txt))

[![Build Status](https://travis-ci.org/o19s/splainer-search.svg?branch=master)](https://travis-ci.org/o19s/splainer-search)

Splainer Search calls out to Solr via JSONP, asking Solr by default to try to explain and highlight all passed in fields. A friendly interface is provided to specify the Solr args in terms of a Javascript object. See below for basic examples

## Basic usage

Splainer-search will perform the specified search against Solr attempting to highlight and extract explain info.

    // searcher that searches id, title, body, author
    var searcher = searchSvc.createSearcher(['id', 'title', 'body', 'author']',
                                                'http://localhost:8983/solr/select',
                                                {
                                                   'q': ['*:*'],
                                                   'fq': ['title:Moby*', 'author:Herman']
                                                 });
    searcher.search()
    .then(function() {
       angular.forEach(searcher.docs, function(doc) {
          console.log(doc.source().title);
          // highlights. You need to pass id as that's how Solr
          // organizes the explain. See below for a friendlier/higher-level
          // interface with normalDocs
          console.log(doc.highlight(doc.source().id, 'title', '<b>', '</b>');
          // explain info
          console.log(doc.explain(doc.source().id);
       });
    });
    

## Paging

Paging is done by asking the original searcher for another searcher. This searcher is already setup to get the next page for the current search results. Tell that searcher to search() just like you did above.

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


## Normalizing docs with normalDocs/fieldSpec

This library was originally written for dealing with debug tools such as [Quepid](http://quepid.com) and [Splainer](http://splainer.io). As such, it provides a lot of help taking a user specified list of fields and associated roles, then once search is done turning the raw docs out of the Solr searcher into something more normalized based on that config (a normalDoc).

The normalDoc provides a friendlier, more standard interface. This includes friendlier parsing of explain information as needed.

```
var userFieldSpec = "id:uuid, title, body, authors"
var fs = fieldSpecSvc.createFieldSpec(userFieldSpec)
var searcher = searchSvc.createSearcher(fs.fieldList(),
                                            'http://localhost:8983/solr/select',
                                            {
                                               'q': ['*:*'],
                                               'fq': ['title:Moby*', 'authors:Herman']
                                             });
searcher.search()
.then(function() {
   var  bestScore = 0;
   angular.forEach(searcher.docs, function(doc) {
        var normalDoc = normalDocSvc.createNormalDoc(fs, doc);
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
        // this drives the horizontal graph bars in Quepid/Splainer
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

### Thanks to...

Development for this library is done primarilly by [OpenSource Connections](http://opensourceconnections.com) for search relevance tools [Splainer](http://splainer.io) and [Quepid](http://quepid.com)

Primary author is [Doug Turnbull](http://softwaredoug.com)

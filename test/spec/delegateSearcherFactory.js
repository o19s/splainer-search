'use strict';

/*global describe,beforeEach,inject,it,expect*/

describe('Factory: delegateSearcherFactory', function () {
    var searchSvc;
    var fieldSpecSvc  = null;
    var mockFieldSpec = null;

    var CustomEngine = {
        addDocToGroup: function(){},
        pager: function(){},
        search: function(){return "custom search"},
        explainOther: function(){},
        explain: function(){},
    }
    // load the service's module
    beforeEach(module('o19s.splainer-search'));

    beforeEach(inject(function (_searchSvc_, _fieldSpecSvc_) {
        searchSvc     = _searchSvc_;
        fieldSpecSvc  = _fieldSpecSvc_;
        mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1');    
    }));

    describe('loads custom searcher', function() {
        beforeEach( () => {
            Window.CustomSearchEngines = {custom: CustomEngine};
        })
        
        it('loads a custom searcher', function(){
            var searcher = searchSvc.createSearcher(
                mockFieldSpec.fieldList,
                "",
                {params:{}},
                "query text",
                {},
                "custom"
              );
            expect(searcher.searchEngine).toEqual("custom")
        })

        it('calls method on a custom searcher', function(){
            var searcher = searchSvc.createSearcher(
                mockFieldSpec.fieldList,
                "",
                {params:{}},
                "query text",
                {},
                "custom"
              );
            expect(searcher.search()).toEqual("custom search")
        })
    })
});
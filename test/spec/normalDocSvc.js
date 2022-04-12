'use strict';

/*global describe,beforeEach,inject,it,expect*/

describe('Service: normalDocsSvc', function () {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  /*jshint camelcase: false */
  var normalDocsSvc = null;
  var vectorSvc = null;
  beforeEach(inject(function (_normalDocsSvc_, _vectorSvc_) {
    normalDocsSvc = _normalDocsSvc_;
    vectorSvc = _vectorSvc_;
  }));

  /* global mockExplain */
  describe('attached url tests', function() {
    var solrDoc = null;
    var normalDoc = null;
    var lastFieldName = null;
    var lastFieldValue = null;
    beforeEach(function() {
      solrDoc = {
        'custom_id_field': '1234',
        'title_field': 'a title',
        origin: function() {
          return this;
        },
        _url: function(fieldName, fieldValue) {
          lastFieldName = fieldName;
          lastFieldValue = fieldValue;
        },
        explain: function() {return mockExplain;}
      };
      var fieldSpec = {id: 'custom_id_field', title: 'title_field'};
      normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
    });

    it('requests url correctly', function() {
      normalDoc._url();
      expect(lastFieldName).toEqual('custom_id_field');
      expect(lastFieldValue).toEqual('1234');
    });

  });

  describe('integer field tests', function() {
    var solrDoc = null;
    var normalDoc = null;
    beforeEach(function() {
      solrDoc = {'custom_id_field': '1234',
                 'title_field': 'a title',
                 'int_field': 1234,
                 origin: function() {
                   return this;
                 },
                 url: function() {
                   return '';
                 },
                 explain: function() {return mockExplain;} };
    });

    it('requests url correctly', function() {
      var fieldSpec = {id: 'custom_id_field', title: 'int_field'};
      normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.title).toEqual('1234');
    });

    it('gets back as sub a string', function() {
      var fieldSpec = {id: 'custom_id_field', title: 'int_field', subs: ['int_field']};
      normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs.int_field).toEqual('1234');
    });

  });

  it('escapes when no highlights', function() {
    var solrDoc = {'custom_id_field': '1234',
                   'title_field': 'a title',
                   'another_field': '<blah>another_value</blah>',
                   origin: function() {
                     return this;
                   },
                   url: function() {
                     return '';
                    },
                   explain: function() {return mockExplain;},
                   highlight: function() {return null;} };
      var fieldSpec = {id: 'custom_id_field', title: 'title_field', subs: ['another_field']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subSnippets().another_field).toContain('&gt;');
      expect(normalDoc.subSnippets().another_field).toContain('&lt;');
  });

  describe('highlight tests', function() {
    var availableHighlight = null;
    var solrDoc = null;
    beforeEach(function() {
      availableHighlight = null;
      solrDoc = {'custom_id_field': '1234',
                 'title_field': 'a title',
                 'another_field': 'another_value',
                 origin: function() {
                   return this;
                 },
                 url: function() {
                   return '';
                  },
                 explain: function() {return mockExplain;},
                 highlight: function(ign, ign2, pre, post) {return pre + availableHighlight + post;} };
    });

    it('ignores highlights for title', function() {
      availableHighlight = 'something';
      var fieldSpec = {id: 'custom_id_field', title: 'title_field', subs: ['another_field']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.title).toEqual(solrDoc.title_field);
      expect(normalDoc.subs.another_field).toEqual(solrDoc.another_field);
      var snips = normalDoc.subSnippets('<b>', '</b>');
      expect(snips.another_field).toEqual('<b>' + availableHighlight + '</b>');
    });

    it('uses highlights for sub fileds', function() {
      availableHighlight = 'something';
      var fieldSpec = {id: 'custom_id_field', title: 'title_field', subs: ['another_field']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs.another_field).toEqual(solrDoc.another_field);
      expect(normalDoc.title).toEqual(solrDoc.title_field);
    });

    it('uses orig value on no hl', function() {
      availableHighlight = null;
      var anotherFieldValue =solrDoc.another_field;
      var fieldSpec = {id: 'custom_id_field', title: 'title_field', subs: ['another_field']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs.another_field).toEqual(anotherFieldValue);
    });
  });


  describe('explain tests', function() {
    var solrDoc = null;
    var solrDocNoExpl = null;
    var basicExplain2 = null;
    beforeEach(function() {

      var basicExplain1 = {
        match: true,
        value: 1.5,
        description: 'weight(text:law in 1234)',
        details: []
      };
      basicExplain2 = {
        match: true,
        value: 0.5,
        description: 'weight(text:order in 1234)',
        details: []
      };

      var sumExplain = {
        match: true,
        value: 1.0,
        description: 'sum of',
        details: [basicExplain1, basicExplain2]
      };

      solrDoc = {'custom_id_field': '1234',
                 'title_field': 'a title',
                 origin: function() {
                   return this;
                 },
                 url: function() {return 'http://127.0.0.1';},
                 explain: function() {return sumExplain;} };
      solrDocNoExpl = {'custom_id_field': '1234',
                 'title_field': 'a title',
                 origin: function() {return this;},
                 url: function() {return 'http://127.0.0.1';},
                 explain: function() {return null;} };
    });

    it('hot matches by max sorted by percentage', function() {
      var fieldSpec = {id: 'custom_id_field', title: 'title_field'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);

      var hmOutOf = normalDoc.hotMatchesOutOf(2.0);
      expect(hmOutOf.length).toBe(2);
      expect(hmOutOf[0].percentage).toBe(75.0);
      expect(hmOutOf[0].description).toContain('law');
      expect(hmOutOf[1].percentage).toBe(25.0);
      expect(hmOutOf[1].description).toContain('order');

    });

    it('uses stub if no explain returned', function() {
      var fieldSpec = {id: 'custom_id_field', title: 'title_field'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDocNoExpl);
      expect(normalDoc.explain().explanation()).toContain('no explain');
      expect(normalDoc.explain().contribution()).toBe(0.0);
    });

    it('decorates with external explain', function() {
      var fieldSpec = {id: 'custom_id_field', title: 'title_field'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDocNoExpl);
      var decoratedDoc = normalDocsSvc.explainDoc(normalDoc, basicExplain2);
      var hmOutOf = decoratedDoc.hotMatchesOutOf(1.0);
      expect(hmOutOf.length).toBe(1);
      expect(hmOutOf[0].description).toContain('order');
      expect(hmOutOf[0].percentage).toBe(50.0);

      var expl = decoratedDoc.explain();
      expect(expl.explanation()).toContain('order');
    });

    it('decorated doc same as original', function() {
      // we need these to be the same to preserve memory
      var fieldSpec = {id: 'custom_id_field', title: 'title_field'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDocNoExpl);
      var decoratedDoc = normalDocsSvc.explainDoc(normalDoc, basicExplain2);
      expect(decoratedDoc).toBe(normalDoc);
    });

    it('uses alt explain if available', function() {
      var fieldSpec = {id: 'custom_id_field', title: 'title_field'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDocNoExpl, basicExplain2);
      var hmOutOf = normalDoc.hotMatchesOutOf(1.0);
      expect(hmOutOf.length).toBe(1);
      expect(hmOutOf[0].description).toContain('order');
      expect(hmOutOf[0].percentage).toBe(50.0);

      var expl = normalDoc.explain();
      expect(expl.explanation()).toContain('order');
    });

    it('gets score', function() {
      var fieldSpec = {id: 'custom_id_field', title: 'title_field'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.score()).toEqual(1.0);
    });

    /* This test captures a bit of an edge case where the user of Splainer/Quepid
     * specifies an id field that while useful as an id field isn't Solr's unique key,
     * so we try to fallback to "id" in these cases when looking up explains
     * */
    it('backs up to looking up with field id when custom id field not present', function() {
      var fieldSpec = {id: 'custom_id_field', title: 'title_field'};
      var idVals = [];
      var sumExplain = solrDoc.explain();
      solrDoc.id = 'solrs_actual_id';
      solrDoc.explain = function(idVal) {
        idVals.push(idVal);
        if (idVal === 'solrs_actual_id') {
          return sumExplain;
        }
        return null;
      };
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(idVals.length).toBe(2); // 2 lookups
      expect(idVals[0]).toEqual(solrDoc.origin().custom_id_field);
      expect(idVals[1]).toEqual(solrDoc.origin().id);
      expect(normalDoc.score()).toEqual(1.0);
    });

  });

  describe('uses origin(), not fields on doc', function() {
    var solrDoc = null;
    var availableHighlights = {};
    var idFromSrc = '5555';
    var titleFromSrc = 'src title';
    var sub1FromSrc = 'srcsub1_val';
    var sub2FromSrc = 'srcsub1_val';

    beforeEach(function() {
      availableHighlights = {};
      solrDoc = {'custom_id_field': '1234',
                 'title_field': 'a title',
                 'sub1': 'sub1_val',
                 'sub2': 'sub2_val',
                 origin: function() {
                   return {'custom_id_field': idFromSrc,
                           'title_field': titleFromSrc,
                           'sub1': sub1FromSrc,
                           'sub2': sub2FromSrc};
                 },
                 url: function() {
                   return '';
                  },
                 explain: function() {return mockExplain;},
                 highlight: function(docId, field, pre, post) {
                   if (availableHighlights.hasOwnProperty(field)) {
                     return pre + availableHighlights[field] + post;
                   }
                   return null;
                 } };
    });

    it('reads fields', function() {
      var fieldSpec = {id: 'custom_id_field', title: 'title_field', subs: '*'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(Object.keys(normalDoc.subs).length).toEqual(2);
      expect(normalDoc.id).toEqual(idFromSrc);
      expect(normalDoc.title).toEqual(titleFromSrc);
      expect(normalDoc.subs.sub1).toEqual(sub1FromSrc);
      expect(normalDoc.subs.sub2).toEqual(sub1FromSrc);
    });

  });

  describe('* subs test', function() {
    var solrDoc = null;
    var availableHighlights = {};
    beforeEach(function() {
      availableHighlights = {};
      solrDoc = {'custom_id_field': '1234',
                 'title_field': 'a title',
                 'sub1': 'sub1_val',
                 'sub2': 'sub2_val',
                 'fn': 2.0,
                 origin: function() {
                   return this;
                 },
                 url: function() {
                   return '';
                  },
                 explain: function() {return mockExplain;},
                 highlight: function(docId, field, pre, post) {
                   if (availableHighlights.hasOwnProperty(field)) {
                     return pre + availableHighlights[field] + post;
                   }
                   return null;
                 } };
    });

    it('works with an empty title', function() {
      solrDoc['actor.name'] = 'Harrison Ford';

      var fieldSpec = {id: 'custom_id_field', title: null, subs: ['actor.name']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);

      expect(normalDoc.getHighlightedTitle('', '')).toEqual(null);
    });


    it('captures sub values no highlights', function() {
      var fieldSpec = {id: 'custom_id_field', title: 'title_field', subs: '*'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(Object.keys(normalDoc.subs).length).toEqual(3);
      expect(normalDoc.subs.sub1).toEqual('sub1_val');
      expect(normalDoc.subs.sub2).toEqual('sub2_val');
    });

    it('captures function values as subs', function() {
      var fieldSpec = {id: 'custom_id_field', title: 'title_field', subs: ['sub2'], functions: ['fn:$fn']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(Object.keys(normalDoc.subs).length).toEqual(2);
      expect(normalDoc.subs.sub2).toEqual('sub2_val');
      expect(normalDoc.subs.fn).toEqual('2');
    });

    it('captures function values with wildcard subs', function() {
      var fieldSpec = {id: 'custom_id_field', title: 'title_field', subs: '*', functions: ['fn:$fn']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(Object.keys(normalDoc.subs).length).toEqual(3);
      expect(normalDoc.subs.sub1).toEqual('sub1_val');
      expect(normalDoc.subs.sub2).toEqual('sub2_val');
      expect(normalDoc.subs.fn).toEqual('2');
    });

    it('captures sub values w/ highlight', function() {
      var fieldSpec = {id: 'custom_id_field', title: 'title_field', subs: '*'};
      availableHighlights.sub1 = 'sub1_hl';
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(Object.keys(normalDoc.subs).length).toEqual(3);
      expect(normalDoc.subs.sub1).toEqual('sub1_val');
      expect(normalDoc.subs.sub2).toEqual('sub2_val');
      expect(normalDoc.subs.fn).toEqual('2');

      expect(normalDoc.subSnippets('<b>', '</b>').sub1).toEqual('<b>sub1_hl</b>');
      expect(normalDoc.subSnippets('<b>', '</b>').sub2).toEqual('sub2_val');
    });

  });

  describe('returns values based on dot notation', function() {
    var solrDoc = null;
    var availableHighlight = null;
    beforeEach(function() {
      availableHighlight = 'something';
      solrDoc = {'id': '1234',
                 'title_field': 'a title',
                 'director': { "credit_id": "52fe44fac3a36847f80b56e7", "name": "Robert Clouse" },
                 origin: function() {
                   return this;
                 },
                 url: function() {
                   return '';
                  },
                 explain: function() {return mockExplain;},
                 highlight: function(ign, ign2, pre, post) {return pre + availableHighlight + post;}
                  };
    });

    it('captures sub values with dot notation', function() {
      var fieldSpec = {id: 'id', title: 'title_field', subs: ['director.name']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs["director.name"]).toEqual('Robert Clouse');

      fieldSpec = {id: 'id', title: 'title_field', subs: ['director.credit_id']};
      normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs["director.credit_id"]).toEqual('52fe44fac3a36847f80b56e7');
      expect(normalDoc.subs["director.name"]).toBe(undefined);

    });

    it('captures sub values with dot notation in an array', function() {

      solrDoc['genres'] =  [{ "name": "Action", "id": 1 },{ "name": "Comedy", "id": 2 }]

      var fieldSpec = {id: 'id', title: 'title_field', subs: ['genres.name']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);

      expect(normalDoc.subs["genres.name"]).toEqual(['Action', 'Comedy']);
    });

    it('captures sub values with dot notation in both an array and a dictionary', function() {

      solrDoc['nesting'] =  { "genres": [ { "name": "Action", "id": 1 },{ "name": "Comedy", "id": 2 }] };

      var fieldSpec = {id: 'id', title: 'title_field', subs: ['nesting.genres.name']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);

      expect(normalDoc.subs["nesting.genres.name"]).toEqual(['Action', 'Comedy']);
    });

    it('captures sub values when the field name has a dot in it, and it isnt using dot notation', function() {

      solrDoc['actor.name'] = "Harrison Ford";

      var fieldSpec = {id: 'id', title: 'title_field', subs: ['actor.name']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs["actor.name"]).toEqual('Harrison Ford');

    });

  });

  describe('handles additional field spec options in JSON format', function() {
    var solrDoc = null;
    var availableHighlight = null;
    beforeEach(function() {
      availableHighlight = 'something';
      solrDoc = {'id': '1234',
                 'title_field': 'a title',
                 'relative_image': '/some/image.png',
                 origin: function() {
                   return this;
                 },
                 url: function() {
                   return '';
                  },
                 explain: function() {return mockExplain;},
                 highlight: function(ign, ign2, pre, post) {return pre + availableHighlight + post;}
                  };
    });

    it('handles passing options for an image', function() {
      var fieldSpec = {id: 'id', title: 'title_field', subs: ['relative_image'], image: 'relative_image', image_options: {prefix: 'http://example.org/'}};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs["relative_image"]).toEqual('/some/image.png');
      expect(normalDoc.image).toEqual('/some/image.png');
      expect(normalDoc.hasImage()).toBeTrue();
      expect(normalDoc.image_options).toEqual({prefix: 'http://example.org/'});


    });
  });

});

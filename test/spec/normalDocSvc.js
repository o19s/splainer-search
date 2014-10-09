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
      solrDoc = {'id_field': '1234',
                 'title_field': 'a title',
                 source: function() {
                   return this;
                 },
                 url: function(fieldName, fieldValue) {
                    lastFieldName = fieldName;
                    lastFieldValue = fieldValue;
                  },
                 explain: function() {return mockExplain;} };
      var fieldSpec = {id: 'id_field', title: 'title_field'};
      normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
    });

    it('requests url correctly', function() {
      normalDoc.url();
      expect(lastFieldName).toEqual('id_field');
      expect(lastFieldValue).toEqual('1234');
    });

  });

  describe('integer field tests', function() {
    var solrDoc = null;
    var normalDoc = null;
    beforeEach(function() {
      solrDoc = {'id_field': '1234',
                 'title_field': 'a title',
                 'int_field': 1234,
                 source: function() {
                   return this;
                 },
                 url: function() {
                   return '';
                 },
                 explain: function() {return mockExplain;} };
    });

    it('requests url correctly', function() {
      var fieldSpec = {id: 'id_field', title: 'int_field'};
      normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.title).toEqual('1234');
    });

    it('gets back as sub a string', function() {
      var fieldSpec = {id: 'id_field', title: 'int_field', subs: ['int_field']};
      normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs.int_field).toEqual('1234');
    });

  });
  
  describe('highlight tests', function() {
    var availableHighlight = null;
    var solrDoc = null;
    beforeEach(function() {
      availableHighlight = null;
      solrDoc = {'id_field': '1234',
                 'title_field': 'a title',
                 'another_field': 'another_value',
                 source: function() {
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
      var fieldSpec = {id: 'id_field', title: 'title_field', subs: ['another_field']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.title).toEqual(solrDoc.title_field);
      expect(normalDoc.subs.another_field).toEqual(solrDoc.another_field);
      var snips = normalDoc.subSnippets('<b>', '</b>');
      expect(snips.another_field).toEqual('<b>' + availableHighlight + '</b>');
    });
    
    it('uses highlights for sub fileds', function() {
      availableHighlight = 'something';
      var fieldSpec = {id: 'id_field', title: 'title_field', subs: ['another_field']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs.another_field).toEqual(solrDoc.another_field);
      expect(normalDoc.title).toEqual(solrDoc.title_field);
    });
    
    it('uses orig value on no hl', function() {
      availableHighlight = null;
      var anotherFieldValue =solrDoc.another_field;
      var fieldSpec = {id: 'id_field', title: 'title_field', subs: ['another_field']};
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

      solrDoc = {'id_field': '1234',
                 'title_field': 'a title',
                 source: function() {
                   return this;
                 },
                 url: function() {return 'http://127.0.0.1';},
                 explain: function() {return sumExplain;} };
      solrDocNoExpl = {'id_field': '1234',
                 'title_field': 'a title',
                 source: function() {return this;},
                 url: function() {return 'http://127.0.0.1';},
                 explain: function() {return null;} };
    });

    it('hot matches by max sorted by percentage', function() {
      var fieldSpec = {id: 'id_field', title: 'title_field'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);

      var hmOutOf = normalDoc.hotMatchesOutOf(2.0);
      expect(hmOutOf.length).toBe(2);
      expect(hmOutOf[0].percentage).toBe(75.0);
      expect(hmOutOf[0].description).toContain('law');
      expect(hmOutOf[1].percentage).toBe(25.0);
      expect(hmOutOf[1].description).toContain('order');

    });

    it('uses stub if no explain returned', function() {
      var fieldSpec = {id: 'id_field', title: 'title_field'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDocNoExpl);
      expect(normalDoc.explain().explanation()).toContain('no explain');
      expect(normalDoc.explain().contribution()).toBe(0.0);
    });

    it('decorates with external explain', function() {
      var fieldSpec = {id: 'id_field', title: 'title_field'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDocNoExpl);
      var decoratedDoc = normalDocsSvc.explainDoc(normalDoc, basicExplain2);
      var hmOutOf = decoratedDoc.hotMatchesOutOf(1.0);
      expect(hmOutOf.length).toBe(1);
      expect(hmOutOf[0].description).toContain('order');
      expect(hmOutOf[0].percentage).toBe(50.0);
      
      var expl = decoratedDoc.explain();
      expect(expl.explanation()).toContain('order');
    });
    
    it('decorates and leaves alone original', function() {
      var fieldSpec = {id: 'id_field', title: 'title_field'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDocNoExpl);
      var explBefore = normalDoc.explain();
      normalDocsSvc.explainDoc(normalDoc, basicExplain2);
      expect(explBefore).toEqual(normalDoc.explain());
    });

    it('gets score', function() {
      var fieldSpec = {id: 'id_field', title: 'title_field'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.score()).toEqual(1.0);
    });
    
  });
  
  describe('uses source(), not fields on doc', function() {
    var solrDoc = null;
    var availableHighlights = {};
    var idFromSrc = '5555';
    var titleFromSrc = 'src title';
    var sub1FromSrc = 'srcsub1_val';
    var sub2FromSrc = 'srcsub1_val';

    beforeEach(function() {
      availableHighlights = {};
      solrDoc = {'id_field': '1234',
                 'title_field': 'a title',
                 'sub1': 'sub1_val',
                 'sub2': 'sub2_val',
                 source: function() {
                   return {'id_field': idFromSrc,
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
      var fieldSpec = {id: 'id_field', title: 'title_field', subs: '*'};
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
      solrDoc = {'id_field': '1234',
                 'title_field': 'a title',
                 'sub1': 'sub1_val',
                 'sub2': 'sub2_val',
                 source: function() {
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

    it('captures sub values no highlights', function() {
      var fieldSpec = {id: 'id_field', title: 'title_field', subs: '*'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(Object.keys(normalDoc.subs).length).toEqual(2);
      expect(normalDoc.subs.sub1).toEqual('sub1_val');
      expect(normalDoc.subs.sub2).toEqual('sub2_val');
    });
    
    it('captures sub values w/ highlight', function() {
      var fieldSpec = {id: 'id_field', title: 'title_field', subs: '*'};
      availableHighlights.sub1 = 'sub1_hl';
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(Object.keys(normalDoc.subs).length).toEqual(2);
      expect(normalDoc.subs.sub1).toEqual('sub1_val');
      expect(normalDoc.subs.sub2).toEqual('sub2_val');

      expect(normalDoc.subSnippets('<b>', '</b>').sub1).toEqual('<b>sub1_hl</b>');
      expect(normalDoc.subSnippets('<b>', '</b>').sub2).toEqual('sub2_val');
    });

  });

  describe('placeholder docs test', function() {


  });

});

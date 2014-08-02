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
  
  describe('highlight tests', function() {
    var availableHighlight = null;
    var solrDoc = null;
    beforeEach(function() {
      availableHighlight = null;
      solrDoc = {'id_field': '1234',
                 'title_field': 'a title',
                 'another_field': 'another_value',
                 url: function() {
                   return '';
                  },
                 explain: function() {return mockExplain;},
                 highlight: function() {return availableHighlight;} };
    });

    it('ignores highlights for title', function() {
      availableHighlight = 'something';
      var fieldSpec = {id: 'id_field', title: 'title_field'};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.title).toEqual(solrDoc.title_field);
    });
    
    it('uses highlights for sub fileds', function() {
      availableHighlight = 'something';
      var fieldSpec = {id: 'id_field', title: 'title_field', subs: ['another_field']};
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, solrDoc);
      expect(normalDoc.subs.another_field).toEqual(availableHighlight);
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
                 url: function() {return 'http://127.0.0.1';},
                 explain: function() {return sumExplain;} };
      solrDocNoExpl = {'id_field': '1234',
                 'title_field': 'a title',
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
  });

});

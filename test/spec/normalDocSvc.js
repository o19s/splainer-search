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

  describe('hot match tests', function() {
    it('converts hot matches to percentage of max', function() {
      var hot = vectorSvc.create();
      hot.set('foo', 5);
      hot.set('bar', 3);

      var hotMatches = normalDocsSvc.hotMatchesToPercentage(hot, 10);
      expect(hotMatches[0].description).toEqual('foo');
      expect(hotMatches[0].value).toEqual(50.0);
      expect(hotMatches[1].description).toEqual('bar');
      expect(hotMatches[1].value).toEqual(30.0);
      expect(hotMatches.length).toBe(2);

    });
  });

});

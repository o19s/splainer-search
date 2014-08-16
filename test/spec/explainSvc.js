'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Service: explainSvc', function () {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  var explainSvc = null;
  beforeEach(inject(function (_explainSvc_) {
    explainSvc = _explainSvc_;
  }));

  /* global mockExplain */
  it('parses mockData1', function() {
    explainSvc.createExplain(mockExplain);
  });

  it('returns null/empty explain', function() {
    var exp = explainSvc.createExplain(null);
    expect(exp.influencers.length).toEqual(0);
    expect(exp.contribution()).toEqual(0);
    expect(exp.explanation()).toContain('no explain');
  });

  describe('weird explains', function() {
    // explains, from say a custom search that might
    // not line up to traditional looking explain stuff
    var weirdExplain = {
      match: true,
      value: 1.5,
      description: 'Weird thing matched',
      details: [
        {
          match: true,
          value: 0.5,
          description: 'part 1 is 0.5',
          details: []
        },    
        {
          match: true,
          value: 0.3,
          description: 'part 2 is 0.3',
          details: []
        },    
        {
          match: true,
          value: 0.7,
          description: 'part 3 is 0.7',
          details: []
        }    
      ]
    };
    
    it('vectorize empty', function() {
      var expl = explainSvc.createExplain(weirdExplain);
      expect(expl.vectorize().get('Weird thing matched')).toEqual(1.5);
      console.log(expl.toStr());
    });

  });
});

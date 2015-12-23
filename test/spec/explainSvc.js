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

  it('how does it perform', function() {
    var d = new Date();
    var start = d.getTime();

    /*global bigHonkinExplain*/
    for (var i = 0; i <10; i++) {
      var simplerExplain = explainSvc.createExplain(bigHonkinExplain);
      simplerExplain.vectorize();
      simplerExplain.matchDetails();
    }


    d = new Date();
    var stop = d.getTime();
    console.log('Parsing Big Explain takes: ' + ((stop - start) / 10.0) + ' ms ' );
  });


  it('handles sum explains', function() {
    var sumExplain = {
      match: true,
      value: 1.5,
      description: 'sum of',
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
    var simplerExplain = explainSvc.createExplain(sumExplain);
    var infl = simplerExplain.influencers();
    expect(infl.length).toEqual(3);
    expect(infl[0].description).toEqual('part 3 is 0.7');
    expect(infl[1].description).toEqual('part 1 is 0.5');
    expect(infl[2].description).toEqual('part 2 is 0.3');
  });

  it('collapses sums with sum children', function() {
    var sumOfSumExplain = {
      match: true,
      value: 1.5,
      description: 'sum of',
      details: [
        {
          match: true,
          value: 0.5,
          description: 'part 1 is 0.5 sum of',
          details: [
            {
              match: true,
              value: 0.2,
              description: 'part 1a is 0.2',
              details: []
            },
            {
              match: true,
              value: 0.3,
              description: 'part 1b is 0.3',
              details: []
            }
          ]
        },
        {
          match: true,
          value: 0.1,
          description: 'part 2 is 0.1',
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
    var simplerExplain = explainSvc.createExplain(sumOfSumExplain);
    var infl = simplerExplain.influencers();
    expect(infl.length).toEqual(4);
    expect(infl[0].description).toEqual('part 3 is 0.7');
    expect(infl[1].description).toEqual('part 1b is 0.3');
    expect(infl[2].description).toEqual('part 1a is 0.2');
    expect(infl[3].description).toEqual('part 2 is 0.1');
  });

  describe('elaticsearch explains', function() {
    // Elasticsearch explain

    it('deals with Math.minOf', function() {
      var minOfExpl = {
          'value': 0.033063494,
          'description': 'Math.min of',
          'details': [{
            'value': 0.033063494,
            'description': 'Function for field created_at:',
            'details': [{
              'value': 0.033063494,
              'description': 'exp(- MIN[Math.max(Math.abs(1.399894202E12(=doc value) - 1.450890423697E12(=origin))) - 0.0(=offset), 0)] * 6.68544734336367E-11)'
            }]
          }, {
            'value': 3.4028235E38,
            'description': 'maxBoost'
          }]
        };
      var simplerExplain = explainSvc.createExplain(minOfExpl);
      // the minof is ignored, as it has one child we jump straight to the function query
      var infl = simplerExplain.influencers();

      //
      expect(infl.length).toEqual(0);
      expect(simplerExplain.explanation()).toContain('exp');
      expect(simplerExplain.explanation()).toContain('f(created_at)');

      var matches = simplerExplain.vectorize();
      expect(Object.keys(matches.vecObj).length).toBe(1); // get down to just the function query
      expect(Object.keys(matches.vecObj)[0]).toContain('exp'); // get down to just the function query
    });

    xit('ignores meaningless queryBoost', function() {
      /* This test is currently ignored, however I'm debating what to do
       * with this scenario. The queryBoost of 1 is only meaningless if there's a function
       * score query with product of.
       *
       * So its sort of an aesthetics debate
       *
       * */

      var funcScoreQuery = {
        'value': 0.033157118,
        'description': 'function score, product of:',
        'details': [{
          'value': 0.033063494,
          'description': 'Math.min of',
          'details': [{
            'value': 0.033063494,
            'description': 'Function for field created_at:',
            'details': [{
              'value': 0.033063494,
              'description': 'exp(- MIN[Math.max(Math.abs(1.399894202E12(=doc value) - 1.450890423697E12(=origin))) - 0.0(=offset), 0)] * 6.68544734336367E-11)'
            }]
          }, {
            'value': 3.4028235E38,
            'description': 'maxBoost'
          }]
        },
        {
          'value': 1.0,
          'description': 'queryBoost'
        }

        ]
      };
      var simplerExplain = explainSvc.createExplain(funcScoreQuery);

      var infl = simplerExplain.influencers();
      expect(infl.length).toEqual(1);
      expect(infl[0].explanation()).toContain('exp');
      expect(infl[0].explanation()).toContain('f(created_at)');

      // we only surface the innermost important function query
      var matches = simplerExplain.vectorize();
      expect(Object.keys(matches.vecObj).length).toBe(1); // get down to just the function query
      expect(Object.keys(matches.vecObj)[0]).toContain('exp'); // get down to just the function query


    });


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

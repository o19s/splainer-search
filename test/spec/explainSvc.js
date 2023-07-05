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
  it('parses mockExplain', function() {
    explainSvc.createExplain(mockExplain);
  });

  it('returns null/empty explain', function() {
    var exp = explainSvc.createExplain(null);
    expect(exp.influencers.length).toEqual(0);
    expect(exp.contribution()).toEqual(0);
    expect(exp.explanation()).toContain('no explain for doc');
  });

  it('handles an empty explain hash', function() {
    var emptyExplain = {};
    var exp = explainSvc.createExplain(emptyExplain);
    expect(exp.influencers.length).toEqual(0);
    expect(exp.contribution()).toEqual(0);
    expect(exp.explanation()).toContain('no explain for doc');
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

  //This test is meant for more recent Solr versions handling multiplicative boosts
  describe('multiplicative boosts in Solr 8.11', function() {
    // Solr explain

    it('deals with multiplicative boosts in Solr', function() {
      var multiplicativeExpl = {
        'match': true,
        'value': 2237.4985427856445,
        'description': 'weight(FunctionScoreQuery(text_all:rambo, scored by boost(sum(int(vote_count),const(0))))), result of:',
        'details': [
          {
            'match': true,
            'value': 2237.4985427856445,
            'description': 'product of:',
            'details': [
            {
              'match': true,
              'value': 2.6078072,
              'description': 'weight(text_all:rambo in 2978) [SchemaSimilarity], result of:',
              'details': [
              {
                'match': true,
                'value': 2.6078072,
                'description': 'score(freq=1.0), computed as boost * idf * tf from:',
                'details': [
                {
                  'match': true,
                  'value': 6.6984444,
                  'description': 'idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:',
                  'details': [
                  {
                    'match': true,
                    'value': 10,
                    'description': "n, number of documents containing term"
                  },
                  {
                    'match': true,
                    'value': 8516,
                    'description': 'N, total number of documents with field'
                  }
                  ]
                },
                {
                  'match': true,
                  'value': 0.38931537,
                  'description': "tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:",
                  'details': [
                  {
                    'match': true,
                    'value': 1,
                    'description': "freq, occurrences of term within document"
                  },
                  {
                    'match': true,
                    'value': 1.2,
                    'description': "k1, term saturation parameter"
                  },
                  {
                    'match': true,
                    'value': 0.75,
                    'description': "b, length normalization parameter"
                  },
                  {
                    'match': true,
                    'value': 168,
                    'description': 'dl, length of field (approximate)'
                  },
                  {
                    'match': true,
                    'value': 119.18542,
                    'description': 'avgdl, average length of field'
                  }
                  ]
                }
                ]
              }
              ]
            },
            {
              'match': true,
              'value': 858,
              'description': 'sum(int(vote_count)=858,const(0))'
            }
            ]
          }
        ]
        };
      var multiplicativeExplain = explainSvc.createExplain(multiplicativeExpl);
      var infl = multiplicativeExplain.influencers();

      //this explain has two factors so we expect these to be the keys of the explanation
      expect(infl.length).toEqual(2);
      expect(multiplicativeExplain.explanation()).toContain('Product');
      var matches = multiplicativeExplain.vectorize();
      //this explain has two factors so we expect these to be the keys of the explanation
      expect(Object.keys(matches.vecObj).length).toBe(2); 
      expect(Object.keys(matches.vecObj)[0]).toContain('sum'); 
    });
  });
  
  //This test is meant for more older Solr versions handling multiplicative boosts
  describe('multiplicative boosts in Solr 4.6', function() {
    // Solr explain

    it('deals with multiplicative boosts in Solr', function() {
      var multiplicativeExpl = {
        match: true,
        value: 1,
        description: "boost(+technicalDescriptionClean_text_de_mv:70 (),termfreq(technicalDescriptionClean_text_de_mv,70)), product of:",
        details: [
          {
            match: true,
            value: 1,
            description: "sum of:",
            details: [
              {
                match: true,
                value: 1,
                description: "weight(technicalDescriptionClean_text_de_mv:70 in 0) [DefaultSimilarity], result of:",
                details: [
                  {
                    match: true,
                    value: 1,
                    description: "fieldWeight in 0, product of:",
                    details: [
                      {
                        match: true,
                        value: 1,
                        description: "tf(freq=1.0), with freq of:",
                        details: [
                          {
                            match: true,
                            value: 1,
                            description: "termFreq=1.0"
                          }
                        ]
                      },
                      {
                        match: true,
                        value: 1,
                        description: "idf(docFreq=1, maxDocs=2)"
                      },
                      {
                        match: true,
                        value: 1,
                        description: "fieldNorm(doc=0)"
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            match: true,
            value: 1,
            description: "termfreq(technicalDescriptionClean_text_de_mv,70)=1"
          }
        ]
      };
      var multiplicativeExplain = explainSvc.createExplain(multiplicativeExpl);
      var infl = multiplicativeExplain.influencers();

      //this explain has two factors so we expect these to be the keys of the explanation
      expect(infl.length).toEqual(2);
      expect(multiplicativeExplain.explanation()).toContain('Product');
      //expect(multiplicativeExplain.explanation()).toContain('sum(int(vote_count)=858,const(0))');

      var matches = multiplicativeExplain.vectorize();
      //this explain has two factors so we expect these to be the keys of the explanation
      expect(Object.keys(matches.vecObj).length).toBe(2); 
      expect(Object.keys(matches.vecObj)[1]).toContain('termfreq'); 
    });
  });

});

'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Factory: Settings Validator', function () {
  beforeEach(module('o19s.splainer-search'));

  var $httpBackend;
  var SettingsValidatorFactory;
  var validator;

  beforeEach(inject(function($injector, _SettingsValidatorFactory_) {
    $httpBackend = $injector.get('$httpBackend');
    SettingsValidatorFactory = _SettingsValidatorFactory_;
  }));

  describe('Solr:', function () {
    var settings = {
      searchUrl:    'http://solr.splainer-searcher.io/solr/statedecoded/select',
      searchEngine: 'solr'
    };

    var fullResponse = {
      "responseHeader": {
        "status": 0,
        "QTime": 0,
        "params": {
          "q": "*:*",
          "indent": "on",
          "wt": "json"
        }
      },
      "response": {
        "numFound": 20148,
        "start": 0,
        "docs": [
          {
            "id":"l_5552",
            "catch_line":"Hours of work.",
            "text":"For purposes of computing.",
            "section":"9.1-703",
            "structure":"Commonwealth Public Safety/Overtime Compensation for Law-Enforcement Employees and Firefighters, Emergency Medical Technicians,",
            "type":"law",
            "_version_":1512671587453632512
          },
          {
            "id":"l_20837",
            "catch_line":"Powers, duties and responsibilities of the Inspector.",
            "text":"foo",
            "section":"45.1-361.28",
            "structure":"Mines and Mining/The Virginia Gas and Oil Act",
            "tags":["locality"],
            "refers_to":["45.1-161.5"],
            "type":"law",
            "_version_":1512671587500818432
          }
        ]
      }
    };
    var funkyDocs =
      [
        {
          "id":"l_5552",
          "text":"For purposes of computing.",
          "section":"9.1-703",
          "structure":"Commonwealth Public Safety/Overtime Compensation for Law-Enforcement Employees and Firefighters, Emergency Medical Technicians,",
          "type":"law",
          'uid': "1234",
          "_version_":1512671587453632512
        },
        {
          "catch_line":"Powers, duties and responsibilities of the Inspector.",
          "text":"foo",
          "section":"45.1-361.28",
          "structure":"Mines and Mining/The Virginia Gas and Oil Act",
          "tags":["locality"],
          "refers_to":["45.1-161.5"],
          "type":"law",
          'uid': "1235",
          "_version_":1512671587500818432
        },
        {
          "id":"l_5552",
          "text":"For purposes of computing.",
          "section":"9.1-703",
          'uid': "1236",
          "_version_":1512671587453632512
        }

        ];

    beforeEach( function () {
      validator = new SettingsValidatorFactory(settings);
    });

    describe('Generates candidate ids', function() {

      it('selects only ids occuring across all docs, bland docs', function() {
          var expectedParams = {
            q: ['*:*'],
          };

          $httpBackend.expectJSONP(urlContainsParams(settings.searchUrl, expectedParams))
            .respond(200, fullResponse);

          var called = 0;
          validator.validateUrl()
          .then(function() {
            expect(validator.idFields.length).toBe(7);
            expect(validator.idFields).toContain('id')
            expect(validator.idFields).toContain('text')
            expect(validator.idFields).toContain('catch_line')
            expect(validator.idFields).toContain('section')
            expect(validator.idFields).toContain('type')
            expect(validator.idFields).toContain('structure')
            expect(validator.idFields).toContain('_version_')
            called++;
          });

          $httpBackend.flush();
          $httpBackend.verifyNoOutstandingExpectation();
          expect(called).toBe(1);
      });

      it('selects only ids occuring across all docs, funkier docs', function() {
        var expectedParams = {
          q: ['*:*'],
        };

        var funkyResponse = angular.copy(fullResponse);
        funkyResponse.response.docs = funkyDocs;

        $httpBackend.expectJSONP(urlContainsParams(settings.searchUrl, expectedParams))
          .respond(200, funkyResponse);

        var called = 0;
        validator.validateUrl()
        .then(function() {
          called++;
          expect(validator.idFields.length).toBe(4);
          expect(validator.idFields).toContain('uid')
          expect(validator.idFields).toContain('text')
          expect(validator.idFields).toContain('section')
          expect(validator.idFields).toContain('_version_')
        });
        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it('selects only ids occuring across all docs, funkier docs', function() {
      });
    });

    describe('Validate URL:', function () {
      it('makes a successful call to the Solr instance', function () {
        var expectedParams = {
          q: ['*:*'],
        };

        $httpBackend.expectJSONP(urlContainsParams(settings.searchUrl, expectedParams))
          .respond(200, fullResponse);

        var called = 0;
        validator.validateUrl()
        .then(function() {
          called++;
        });

        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it('extracts the list of fields', function () {
        var expectedParams = {
          q: ['*:*'],
        };

        $httpBackend.expectJSONP(urlContainsParams(settings.searchUrl, expectedParams))
          .respond(200, fullResponse);

        var called = 0;
        validator.validateUrl()
        .then(function() {
          called++;
          expect(validator.fields).toEqual([ 'id', 'catch_line', 'text', 'section', 'structure', 'type', '_version_', 'tags', 'refers_to' ])
        });

        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });
    });
  });

  describe('ES:', function () {
    var settings = {
      searchUrl:    'http://es.splainer-searcher.io/tmdb/_select',
      searchEngine: 'es'
    };

    var fullResponse = {
      hits: {
        hits: [
          {
            _score: 6.738184,
            _type:  "movie",
            _id:    "AU8pXbemwjf9yCj9Xh4e",
            _source: {
              title:        "Rambo",
              id:           5039,
              name:         "Rambo Collection"
            },
            _index: "tmdb",
            highlight: {
              title: [
                "<em>Rambo</em>"
              ]
            }
          },
          {
            _score:   4.1909046,
            _type:    "movie",
            _id:      "AU8pXau9wjf9yCj9Xhug",
            _source: {
              poster_path:  "/cUJgu5U6MHj9GF1weNtIPvN3IoS.jpg",
              id:           1370,
              title:        "Rambo III"
            },
            _index: "tmdb"
          }
        ],
        total:      2,
        max_score:  6.738184
      },
      _shards: {
        successful: 5,
        failed:     0,
        total:      5
      },
      took:       88,
      timed_out:  false
    };

    beforeEach( function () {
      validator = new SettingsValidatorFactory(settings);
    });

    describe('Generates candidate ids', function() {

      it('selects only ids occuring across all docs', function() {
          var expectedParams = {
            q: ['*:*'],
          };

          $httpBackend.expectPOST(settings.searchUrl).respond(200, fullResponse);

          var called = 0;
          validator.validateUrl()
          .then(function() {
            expect(validator.idFields.length).toBe(3);
            expect(validator.idFields).toContain('id')
            expect(validator.idFields).toContain('_id')
            expect(validator.idFields).toContain('title')
            called++;
          });

          $httpBackend.flush();
          $httpBackend.verifyNoOutstandingExpectation();
          expect(called).toBe(1);
      });

    });

    describe('Validate URL:', function () {
      it('makes a successful call to the ES instance', function () {
        $httpBackend.expectPOST(settings.searchUrl).respond(200, fullResponse);

        var called = 0;
        validator.validateUrl()
        .then(function() {
          called++;
        });

        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it('extracts the list of fields', function () {
        $httpBackend.expectPOST(settings.searchUrl).respond(200, fullResponse);

        var called = 0;
        validator.validateUrl()
        .then(function() {
          called++;
          expect(validator.fields).toEqual(['_id', 'title', 'id', 'name', 'poster_path'])
        });

        $httpBackend.flush();
        $httpBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });
    });
  });
});

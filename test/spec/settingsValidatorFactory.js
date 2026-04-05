"use strict";

/* global createFetchClient, MockHttpBackend, urlContainsParams */
describe("Factory: Settings Validator", function () {
  beforeEach(module("o19s.splainer-search"));

  var mockBackend;
  beforeEach(module(function ($provide) {
    mockBackend = new MockHttpBackend();
    $provide.factory('httpClient', function () {
      return createFetchClient({
        fetch: mockBackend.fetch,
        jsonpRequest: mockBackend.jsonpRequest,
      });
    });
  }));

  var SettingsValidatorFactory;
  var validator;

  beforeEach(inject(function (_SettingsValidatorFactory_) {
    SettingsValidatorFactory = _SettingsValidatorFactory_;
  }));

  describe("Solr:", function () {
    var settings = {
      searchUrl: "http://solr.splainer-searcher.io/solr/statedecoded/select",
      searchEngine: "solr",
    };

    var fullResponse = {
      responseHeader: {
        status: 0,
        QTime: 0,
        params: {
          q: "*:*",
          indent: "on",
          wt: "json",
        },
      },
      response: {
        numFound: 20148,
        start: 0,
        docs: [
          {
            id: "l_5552",
            catch_line: "Hours of work.",
            text: "For purposes of computing.",
            section: "9.1-703",
            structure:
              "Commonwealth Public Safety/Overtime Compensation for Law-Enforcement Employees and Firefighters, Emergency Medical Technicians,",
            type: "law",
            _version_: 1512671587453632512,
          },
          {
            id: "l_20837",
            catch_line: "Powers, duties and responsibilities of the Inspector.",
            text: "foo",
            section: "45.1-361.28",
            structure: "Mines and Mining/The Virginia Gas and Oil Act",
            tags: ["locality"],
            refers_to: ["45.1-161.5"],
            type: "law",
            _version_: 1512671587500818432,
          },
        ],
      },
    };
    var funkyDocs = [
      {
        id: "l_5552",
        text: "For purposes of computing.",
        section: "9.1-703",
        structure:
          "Commonwealth Public Safety/Overtime Compensation for Law-Enforcement Employees and Firefighters, Emergency Medical Technicians,",
        type: "law",
        uid: "1234",
        _version_: 1512671587453632512,
      },
      {
        catch_line: "Powers, duties and responsibilities of the Inspector.",
        text: "foo",
        section: "45.1-361.28",
        structure: "Mines and Mining/The Virginia Gas and Oil Act",
        tags: ["locality"],
        refers_to: ["45.1-161.5"],
        type: "law",
        uid: "1235",
        _version_: 1512671587500818432,
      },
      {
        id: "l_5552",
        text: "For purposes of computing.",
        section: "9.1-703",
        uid: "1236",
        _version_: 1512671587453632512,
      },
    ];

    beforeEach(function () {
      validator = new SettingsValidatorFactory(settings);
    });

    describe("Generates candidate ids", function () {
      it("selects only ids occuring across all docs, bland docs", async function () {
        var expectedParams = {
          q: ["*:*"],
        };

        mockBackend
          .expectJSONP(urlContainsParams(settings.searchUrl, expectedParams))
          .respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          expect(validator.idFields.length).toBe(7);
          expect(validator.idFields).toContain("id");
          expect(validator.idFields).toContain("text");
          expect(validator.idFields).toContain("catch_line");
          expect(validator.idFields).toContain("section");
          expect(validator.idFields).toContain("type");
          expect(validator.idFields).toContain("structure");
          expect(validator.idFields).toContain("_version_");
          called++;
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it("selects only ids occuring across all docs, funkier docs", async function () {
        var expectedParams = {
          q: ["*:*"],
        };

        var funkyResponse = structuredClone(fullResponse);
        funkyResponse.response.docs = funkyDocs;

        mockBackend
          .expectJSONP(urlContainsParams(settings.searchUrl, expectedParams))
          .respond(200, funkyResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          called++;
          expect(validator.idFields.length).toBe(4);
          expect(validator.idFields).toContain("uid");
          expect(validator.idFields).toContain("text");
          expect(validator.idFields).toContain("section");
          expect(validator.idFields).toContain("_version_");
        });
        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

    });

    describe("Validate URL:", function () {
      it("makes a successful call to the Solr instance", async function () {
        var expectedParams = {
          q: ["*:*"],
        };

        mockBackend
          .expectJSONP(urlContainsParams(settings.searchUrl, expectedParams))
          .respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          called++;
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it("extracts the list of fields", async function () {
        var expectedParams = {
          q: ["*:*"],
        };

        mockBackend
          .expectJSONP(urlContainsParams(settings.searchUrl, expectedParams))
          .respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          called++;
          expect(validator.fields).toEqual([
            "id",
            "catch_line",
            "text",
            "section",
            "structure",
            "type",
            "_version_",
            "tags",
            "refers_to",
          ]);
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it("validateUrl rejects when the Solr request fails", async function () {
        mockBackend
          .expectJSONP(urlContainsParams(settings.searchUrl, { q: ["*:*"] }))
          .respond(500, { error: "fail" });

        var rejected = 0;
        await validator.validateUrl().then(
          function () {
            rejected--;
          },
          function () {
            rejected++;
          },
        );

        expect(rejected).toBe(1);
      });

      it("throws when proxy is combined with Solr default JSONP transport", function () {
        var proxyUrl = "http://myserver/proxy?proxy=";
        var settings = {
          searchUrl:
            "http://solr.splainer-searcher.io/solr/statedecoded/select",
          searchEngine: "solr",
          proxyUrl: proxyUrl,
        };
        validator = new SettingsValidatorFactory(settings);

        expect(function () {
          validator.validateUrl();
        }).toThrowError(
          "It does not make sense to proxy a JSONP connection, use GET instead.",
        );
      });

      it("makes a successful PROXIED call to the Solr instance", async function () {
        var proxyUrl = "http://myserver/proxy?proxy=";
        var settings = {
          searchUrl:
            "http://solr.splainer-searcher.io/solr/statedecoded/select",
          searchEngine: "solr",
          apiMethod: "GET",
          proxyUrl: proxyUrl,
        };
        validator = new SettingsValidatorFactory(settings);

        var expectedUrl =
          proxyUrl +
          settings.searchUrl +
          "?" +
          "q=*:*&fl=*&wt=json&debug=true&debug.explain.structured=true&hl=false&rows=10";
        //urlContainsParams fails on parsing out the url because of our proxied format
        mockBackend.expectGET(expectedUrl).respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          called++;
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });
    });
  });

  describe("ES:", function () {
    var settings = {
      searchUrl: "http://es.splainer-searcher.io/tmdb/_select",
      searchEngine: "es",
    };

    var fullResponse = {
      hits: {
        hits: [
          {
            _score: 6.738184,
            _type: "movie",
            _id: "AU8pXbemwjf9yCj9Xh4e",
            _source: {
              title: "Rambo",
              id: 5039,
              name: "Rambo Collection",
            },
            _index: "tmdb",
            highlight: {
              title: ["<em>Rambo</em>"],
            },
          },
          {
            _score: 4.1909046,
            _type: "movie",
            _id: "AU8pXau9wjf9yCj9Xhug",
            _source: {
              poster_path: "/cUJgu5U6MHj9GF1weNtIPvN3IoS.jpg",
              id: 1370,
              title: "Rambo III",
            },
            _index: "tmdb",
          },
        ],
        total: 2,
        max_score: 6.738184,
      },
      _shards: {
        successful: 5,
        failed: 0,
        total: 5,
      },
      took: 88,
      timed_out: false,
    };

    beforeEach(function () {
      validator = new SettingsValidatorFactory(settings);
    });

    describe("Generates candidate ids", function () {
      it("selects only ids occuring across all docs", async function () {
        mockBackend.expectPOST(settings.searchUrl).respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          expect(validator.idFields.length).toBe(3);
          expect(validator.idFields).toContain("id");
          expect(validator.idFields).toContain("_id");
          expect(validator.idFields).toContain("title");
          called++;
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });
    });

    describe("Validate URL:", function () {
      it("makes a successful call to the ES instance", async function () {
        mockBackend.expectPOST(settings.searchUrl).respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          called++;
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it("extracts the list of fields", async function () {
        mockBackend.expectPOST(settings.searchUrl).respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          called++;
          expect(validator.fields).toEqual([
            "_id",
            "title",
            "id",
            "name",
            "poster_path",
          ]);
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it("validateUrl rejects when the ES request fails", async function () {
        mockBackend.expectPOST(settings.searchUrl).respond(502, {});

        var rejected = 0;
        await validator.validateUrl().then(
          function () {
            rejected--;
          },
          function () {
            rejected++;
          },
        );

        expect(rejected).toBe(1);
      });
    });
  });

  describe("SearchApi:", function () {
    var settings = {
      searchUrl: "http://mycompany/api/search",
      searchEngine: "searchapi",
      args: "query=tesla",
      apiMethod: "GET",
    };
    settings.docsMapper = function (data) {
      let docs = [];
      for (let doc of data) {
        docs.push({
          id: doc.publication_id,
          publish_date_int: doc.publish_date_int,
          title: doc.title,
        });
      }
      return docs;
    };

    var fullResponse = [
      {
        publication_id: "12345678",
        publish_date_int: "20230601",
        score: 0.5590707659721375,
        title: "INFOGRAPHIC: Automakers' transition to EVs speeds up",
      },
      {
        publication_id: "1234567",
        publish_date_int: "20230608",
        score: 0.5500463247299194,
        title: "Tesla - March 2023 (LTM): Peer Snapshot",
      },
      {
        publication_id: "123456",
        publish_date_int: "20230731",
        score: 0.5492520928382874,
        title: "Tesla",
      },
      {
        publication_id: "987654",
        publish_date_int: "20230906",
        score: 0.549148440361023,
        title: "Tesla Motor Company - June 2023 (LTM): Peer Snapshot",
      },
      {
        publication_id: "765432",
        publish_date_int: "20221201",
        score: 0.5465325117111206,
        title: "Tesla Motor Company - September 2022 (LTM): Peer Snapshot",
      },
    ];

    beforeEach(function () {
      validator = new SettingsValidatorFactory(settings);
    });

    describe("Generates candidate ids", function () {
      it("selects only ids occuring across all docs", async function () {
        mockBackend
          .expectGET(settings.searchUrl + "?" + settings.args)
          .respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          expect(validator.idFields.length).toBe(3);
          expect(validator.idFields).toContain("id");
          expect(validator.idFields).toContain("publish_date_int");
          expect(validator.idFields).toContain("title");
          called++;
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });
    });

    describe("Tracks the last response from the search api", function () {
      it("selects only ids occuring across all docs", async function () {
        mockBackend
          .expectGET(settings.searchUrl + "?" + settings.args)
          .respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          called++;
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);

        expect(validator.searcher.lastResponse).toEqual(fullResponse);
      });
    });

    describe("Validate URL:", function () {
      it("makes a successful call to the SearchApi instance", async function () {
        mockBackend
          .expectGET(settings.searchUrl + "?" + settings.args)
          .respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          called++;
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it("extracts the list of fields", async function () {
        mockBackend
          .expectGET(settings.searchUrl + "?" + settings.args)
          .respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          called++;
          expect(validator.fields).toEqual(["id", "publish_date_int", "title"]);
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it("validateUrl rejects when the SearchApi request fails", async function () {
        mockBackend
          .expectGET(settings.searchUrl + "?" + settings.args)
          .respond(500, {});

        var rejected = 0;
        await validator.validateUrl().then(
          function () {
            rejected--;
          },
          function () {
            rejected++;
          },
        );

        expect(rejected).toBe(1);
      });
    });
  });

  describe("Algolia:", function () {
    var settings = {
      searchUrl: "https://index.algolianet.com/1/indexes/products/query",
      searchEngine: "algolia",
      apiMethod: "POST",
    };

    var fullResponse = {
      hits: [
        {
          objectID: "obj1",
          title: "Product A",
          price: 10.99,
          category: "electronics",
        },
        {
          objectID: "obj2",
          title: "Product B",
          price: 24.5,
          category: "electronics",
        },
      ],
      nbHits: 2,
      page: 0,
      nbPages: 1,
      hitsPerPage: 10,
    };

    beforeEach(function () {
      validator = new SettingsValidatorFactory(settings);
    });

    describe("Generates candidate ids", function () {
      it("selects only ids occurring across all docs", async function () {
        mockBackend.expectPOST(settings.searchUrl).respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          // Algolia's docMapper adds an `id` field copied from objectID
          expect(validator.idFields.length).toBe(5);
          expect(validator.idFields).toContain("objectID");
          expect(validator.idFields).toContain("id");
          expect(validator.idFields).toContain("title");
          expect(validator.idFields).toContain("price");
          expect(validator.idFields).toContain("category");
          called++;
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });
    });

    describe("Validate URL:", function () {
      it("makes a successful call to the Algolia instance", async function () {
        mockBackend.expectPOST(settings.searchUrl).respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          called++;
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it("extracts the list of fields", async function () {
        mockBackend.expectPOST(settings.searchUrl).respond(200, fullResponse);

        var called = 0;
        await validator.validateUrl().then(function () {
          called++;
          // Algolia's docMapper adds `id` from objectID at the end
          expect(validator.fields).toEqual([
            "objectID",
            "title",
            "price",
            "category",
            "id",
          ]);
        });

        mockBackend.verifyNoOutstandingExpectation();
        expect(called).toBe(1);
      });

      it("validateUrl rejects when the search request fails", async function () {
        mockBackend.expectPOST(settings.searchUrl).respond(500, { error: "fail" });

        var rejected = 0;
        await validator.validateUrl().then(
          function () {
            rejected--;
          },
          function () {
            rejected++;
          },
        );

        expect(rejected).toBe(1);
      });
    });
  });

  describe("Vectara:", function () {
    var settings = {
      searchUrl: "https://api.vectara.io:443/v1/query",
      searchEngine: "vectara",
      apiMethod: "POST",
    };

    var fullResponse = {
      responseSet: [
        {
          response: [],
          status: [],
          document: [
            {
              id: "doc-a",
              metadata: [
                { name: "title", value: "Alpha" },
                { name: "section", value: "1" },
              ],
            },
            {
              id: "doc-b",
              metadata: [
                { name: "title", value: "Beta" },
                { name: "section", value: "2" },
              ],
            },
          ],
          generated: [],
          summary: [],
          futureId: 1,
        },
      ],
      status: [],
      metrics: null,
    };

    beforeEach(function () {
      validator = new SettingsValidatorFactory(settings);
    });

    it("extracts field ids from metadata-backed docs (sourceDoc path)", async function () {
      mockBackend.expectPOST(settings.searchUrl).respond(200, fullResponse);

      var called = 0;
      await validator.validateUrl().then(function () {
        expect(validator.idFields).toContain("id");
        expect(validator.idFields).toContain("title");
        expect(validator.idFields).toContain("section");
        expect(validator.idFields.length).toBe(3);
        called++;
      });

      mockBackend.verifyNoOutstandingExpectation();
      expect(called).toBe(1);
    });

    it("validateUrl rejects when the Vectara request fails", async function () {
      mockBackend.expectPOST(settings.searchUrl).respond(503, {});

      var rejected = 0;
      await validator.validateUrl().then(
        function () {
          rejected--;
        },
        function () {
          rejected++;
        },
      );

      expect(rejected).toBe(1);
    });
  });
});

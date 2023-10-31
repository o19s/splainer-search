'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Service: transport: es bulk transport', function() {
  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  var $httpBackend;
  var $timeout;
  var BulkTransportFactory;

  beforeEach(inject(function (_BulkTransportFactory_) {
    BulkTransportFactory = _BulkTransportFactory_;
  }));

  beforeEach(inject(function($injector) {
    $httpBackend = $injector.get('$httpBackend');
    $timeout = $injector.get('$timeout');
  }));

  var mockResultsTemplate = {
    hits: {
      total: 2,
      'max_score': 1.0,
      hits: [
        {
        }
      ]
    }
  };

  var mockResultsErrorTemplate = {
    error: 'Error for query'
  };

  var buildMockResults = function(howMany) {
    var i = 0;
    var results = {'responses': []};
    for (i = 0; i < howMany; i++) {
      var mockResults = angular.copy(mockResultsTemplate);
      mockResults.hits.total = i;
      results.responses[i] = mockResults;
    }
    return results;
  };

  var hasExpectedJsonList = function(expectedObjects) {
    return {
      test: function(textSent) {
        if (!textSent.endsWith('\n')) {
          return false;
        }
        textSent = textSent.substring(0, textSent.length - 1);
        var sentObjs = textSent.split('\n');
        if (sentObjs.length !== expectedObjects.length) {
          return false;
        }
        else {
          var i = 0;
          for (i = 0; i < sentObjs.length; i++) {
            var ithObj = JSON.parse(sentObjs[i]);
            if (!angular.equals(expectedObjects[i], ithObj)) {
              return false;
            }
          }
        }
        return true;

      }
    };
  };

  var containsExpectedHeaders = function(expectedHeaders) {
    return function(headerSent) {
        angular.forEach(expectedHeaders, function(headerValue, headerKey) {
          if (!headerSent.hasOwnProperty(headerKey)) {
            return false;
          } else if (headerSent[headerKey] !== headerValue) {
            return false;
          }
        });
        return true;
      };
  };

  it('sends whats in queue after timeout', function () {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var payloadTemplate = {'test': 0};
    var headers = {'header': 1};

    // queue a bunch of messages
    var expectedObjects = [];
    var i = 0;
    var numToQuery = 10;
    for (i = 0; i < numToQuery; i++) {
      var payload = angular.copy(payloadTemplate);
      payload.test = i;
      bulkTransport.query(url, payload, headers);
      expectedObjects.push({});
      expectedObjects.push(payload);
    }

    var mockResults = buildMockResults(numToQuery);

    $httpBackend.expectPOST(url,
                            hasExpectedJsonList(expectedObjects), containsExpectedHeaders(headers))
    .respond(200, mockResults);
    $timeout.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });


  it('resolves whats in flight', function () {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var payloadTemplate = {'test': 0};
    var headers = {'header': 1};

    // queue a bunch of messages
    var expectedObjects = [];
    var i = 0;
    var numToQuery = 10;
    var promisesResolved = 0;
    var mockResults = buildMockResults(numToQuery);

    var indivSuccessCheck = function(requestIdx) {
      return function(results) {
        expect(results.data).toEqual(mockResults.responses[requestIdx]);
        promisesResolved++;
      };
    };

    for (i = 0; i < numToQuery; i++) {
      var payload = angular.copy(payloadTemplate);
      payload.test = i;
      bulkTransport.query(url, payload, headers).then(indivSuccessCheck(i));
      expectedObjects.push({});
      expectedObjects.push(payload);
    }


    $httpBackend.expectPOST(url,
                            hasExpectedJsonList(expectedObjects), containsExpectedHeaders(headers))
    .respond(200, mockResults);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    expect(promisesResolved).toBe(numToQuery);
  });

  it('rejects individual errors', function () {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var payloadTemplate = {'test': 0};
    var headers = {'header': 1};

    // queue a bunch of messages
    var expectedObjects = [];
    var i = 0;
    var numToQuery = 10;
    var promisesResolved = 0;
    var promisesRejected = 0;
    var mockResults = buildMockResults(numToQuery);
    mockResults.responses[2] = angular.copy(mockResultsErrorTemplate);
    mockResults.responses[4] = angular.copy(mockResultsErrorTemplate);

    var indivSuccessCheck = function(requestIdx) {
      return function(results) {
        expect(results.data).toEqual(mockResults.responses[requestIdx]);
        promisesResolved++;
      };
    };

    var indivErrorCheck = function(requestIdx) {
      return function(results) {
        expect(results).toEqual(mockResults.responses[requestIdx]);
        promisesRejected++;
      };
    };

    for (i = 0; i < numToQuery; i++) {
      var payload = angular.copy(payloadTemplate);
      payload.test = i;
      bulkTransport.query(url, payload, headers).then(indivSuccessCheck(i), indivErrorCheck(i));
      expectedObjects.push({});
      expectedObjects.push(payload);
    }


    $httpBackend.expectPOST(url,
                            hasExpectedJsonList(expectedObjects), containsExpectedHeaders(headers))
    .respond(200, mockResults);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    expect(promisesResolved).toBe(8);
    expect(promisesRejected).toBe(2);
  });

  it('rejects all on http errors', function () {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var payloadTemplate = {'test': 0};
    var headers = {'header': 1};

    var expectedObjects = [];
    var numToQuery = 10;
    var promisesResolved = 0;
    var promisesRejected = 0;
    var mockResults = buildMockResults(numToQuery);

    var indivSuccessCheck = function(requestIdx) {
      return function(results) {
        expect(results.date).toEqual(mockResults.responses[requestIdx]);
        promisesResolved++;
      };
    };

    var indivErrorCheck = function() {
      return function() {
        promisesRejected++;
      };
    };

    for (var i = 0; i < numToQuery; i++) {
      var payload = angular.copy(payloadTemplate);
      payload.test = i;
      bulkTransport.query(url, payload, headers).then(indivSuccessCheck(i), indivErrorCheck(i));
      expectedObjects.push({});
      expectedObjects.push(payload);
    }

    $httpBackend.expectPOST(url,
                            hasExpectedJsonList(expectedObjects), containsExpectedHeaders(headers))
    .respond(400, {});
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    expect(promisesResolved).toBe(0);
    expect(promisesRejected).toBe(numToQuery);

  });

  it('bulks requests serially', function () {
    var bulkTransport = new BulkTransportFactory();
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var payloadTemplate = {'test': 0};
    var headers = {'header': 1};

    // queue a bunch of messages
    var expectedObjects = [];
    var i = 0;
    var numToQuery = 10;
    var promisesResolved = 0;
    var mockResults = buildMockResults(numToQuery);

    var indivSuccessCheck = function(requestIdx) {
      return function(results) {
        expect(results.data).toEqual(mockResults.responses[requestIdx]);
        promisesResolved++;
      };
    };

    var payload = {};
    for (i = 0; i < numToQuery; i++) {
      payload = angular.copy(payloadTemplate);
      payload.test = i;
      bulkTransport.query(url, payload, headers).then(indivSuccessCheck(i));
      expectedObjects.push({});
      expectedObjects.push(payload);
    }


    $httpBackend.expectPOST(url,
                            hasExpectedJsonList(expectedObjects), containsExpectedHeaders(headers))
    .respond(200, mockResults);
    $timeout.flush();

    var expectedObjectsBatch2 = [];
    // append further to the queue in addition to some that are in flight,
    // only
    for (i = 0; i < numToQuery; i++) {
      payload = angular.copy(payloadTemplate);
      payload.test = numToQuery + i;
      bulkTransport.query(url, payload, headers).then(indivSuccessCheck(i));
      expectedObjectsBatch2.push({});
      expectedObjectsBatch2.push(payload);
    }

    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    expect(promisesResolved).toBe(numToQuery);

    // put the second batch in flight,
    // verify they came back
    $httpBackend.expectPOST(url,
                            hasExpectedJsonList(expectedObjectsBatch2), containsExpectedHeaders(headers))
    .respond(200, mockResults);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    expect(promisesResolved).toBe(numToQuery * 2);
  });

  it('doesnt issue http if nothing to send', function () {
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = {'header': 1};
    var bulkTransport = new BulkTransportFactory();
    var payloadTemplate = {'test': 0};
    var payload = angular.copy(payloadTemplate);
    var mockResults = buildMockResults(1);
    bulkTransport.query(url, payload, headers);
    $httpBackend.expectPOST(url).respond(200, mockResults);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
    $timeout.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('adds a trailing \n', function () {

    var trailingEndlineTest = {
      test: function(data) {
        return data.endsWith('\n');
      }
    };

    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = {'header': 1};
    var bulkTransport = new BulkTransportFactory();
    var payloadTemplate = {'test': 0};
    var payload = angular.copy(payloadTemplate);
    var mockResults = buildMockResults(1);
    bulkTransport.query(url, payload, headers);
    $httpBackend.expectPOST(url, trailingEndlineTest).respond(200, mockResults);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });


  it('changes URLs', function () {
    var url = 'http://es.splainer-search.com/foods/tacos/_msearch';
    var headers = {'header': 1};
    var bulkTransport = new BulkTransportFactory();
    var payloadTemplate = {'test': 0};
    var payload = angular.copy(payloadTemplate);
    var mockResults = buildMockResults(1);
    bulkTransport.query(url, payload, headers);
    $httpBackend.expectPOST(url).respond(200, mockResults);
    $timeout.flush();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();

    var url2 = 'http://es2.splainer-search.com/foods/tacos/_msearch';
    bulkTransport.query(url2, payload, headers);
    $httpBackend.expectPOST(url2).respond(200, mockResults);
    $timeout.flush();
    $httpBackend.flush();
  });
});

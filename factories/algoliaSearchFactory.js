'use strict';

/*jslint latedef:false*/

import { isAbortError, transportRequestOpts } from '../services/transportRequestOpts.js';

export function AlgoliaSearcherFactory(
  AlgoliaDocFactory,
  activeQueries,
  algoliaSearcherPreprocessorSvc,
  esUrlSvc,
  SearcherFactory,
  transportSvc,
  utilsSvc,
) {
  var Searcher = function (options) {
    SearcherFactory.call(this, options, algoliaSearcherPreprocessorSvc);
  };

  Searcher.prototype = Object.create(SearcherFactory.prototype);
  Searcher.prototype.constructor = Searcher; // Reset the constructor

  Searcher.prototype.addDocToGroup = addDocToGroup;
  Searcher.prototype.pager = pager;
  Searcher.prototype.search = search;
  Searcher.prototype.getTransportParameters = getTransportParameters;

  function addDocToGroup(_groupedBy, _group, _algoliaDoc) {
    /*jslint validthis:true*/
    console.log('addDocToGroup');
  }

  // return a new searcher that will give you
  // the next page upon search(). To get the subsequent
  // page, call pager on that searcher
  function pager() {
    /*jslint validthis:true*/
    var self = this;
    var page = 0;
    var nextArgs = utilsSvc.deepClone(self.args);

    if (Object.hasOwn(nextArgs, 'page') && nextArgs.page >= 0) {
      page = nextArgs.page;
    }

    if (page !== undefined && page >= 0) {
      page = parseInt(page) + 1;
      if (page > self.nbPages - 1) {
        return null; // no more results
      }
    } else {
      page = 0;
    }

    nextArgs.page = page;
    var options = {
      args: nextArgs,
      config: self.config,
      queryText: self.queryText,
      type: self.type,
      url: self.url,
    };

    var nextSearcher = new Searcher(options);
    return nextSearcher;
  }

  function getIndexName(url) {
    var pathFragments = new URL(url).pathname.split('/').filter(function (item) {
      return item.length > 0;
    });

    return pathFragments[pathFragments.length - 2];
  }

  function constructObjectQueryUrl(url) {
    var urlObject = new URL(url);
    urlObject.pathname = '/1/indexes/*/objects';
    return urlObject.toString();
  }

  /**
   * Algolia has a [separate endpoint ](https://www.algolia.com/doc/rest-api/search/#get-objects)to retrieve documents/objects
   * Using the flag from self.retrieveObjects to switch to a different url.
   * The logic below finds out the index from the configured URL and constructs the endpoint to retrieve the documents.
   * This, however, won't work when we introduce the capability to query multiple indices at the same time.
   *
   * @typedef {object} TransportParameters
   * @property {string} url
   * @property {object} headers
   * @property {string} headers.x-algolia-api-key
   * @property {string} headers.x-algolia-application-id
   * @property {object} payload
   * @property {string} responseKey - This is used as key to retrieve array of documents from Algolia response.
   * @param {boolean} retrieveObjects
   *
   * @returns {TransportParameters}
   */
  function getTransportParameters(retrieveObjects) {
    var self = this;
    var uri = esUrlSvc.parseUrl(self.url);
    var url = esUrlSvc.buildUrl(uri);
    var headers = esUrlSvc.getHeaders(uri, self.config.customHeaders);
    var payload = {};

    if (retrieveObjects) {
      var indexName = getIndexName(url);
      var objectsUrl = constructObjectQueryUrl(url);

      var attributesToRetrieve =
        self.queryDsl && self.queryDsl.attributesToRetrieve
          ? self.queryDsl.attributesToRetrieve
          : undefined;

      payload = {
        requests: self.args.objectIds.map((id) => {
          return {
            indexName: indexName,
            objectID: id,
            attributesToRetrieve: attributesToRetrieve,
          };
        }),
      };

      return {
        url: objectsUrl,
        headers: headers,
        payload: payload,
        responseKey: 'results', // Object retrieval results array is in `results`
      };
    } else {
      payload = self.queryDsl;
      return {
        url: url,
        headers: headers,
        payload: payload,
        responseKey: 'hits', // Query results array is in `hits`
      };
    }
  }

  // search (execute the query) and produce results
  // to the returned future
  function search() {
    /*jslint validthis:true*/

    const self = this;
    var apiMethod = self.config.apiMethod;
    var proxyUrl = self.config.proxyUrl;
    var transport = transportSvc.getTransport({ apiMethod: apiMethod, proxyUrl: proxyUrl });

    var retrieveObjects = self.args.retrieveObjects;

    var transportParameters = self.getTransportParameters(retrieveObjects);

    self.inError = false;

    activeQueries.count++;

    return transport
      .query(
        transportParameters.url,
        transportParameters.payload,
        transportParameters.headers,
        transportRequestOpts(self.config),
      )
      .then(
        function success(httpConfig) {
          const data = httpConfig.data;

          self.lastResponse = data;

          activeQueries.count--;

          // Search responses include nbHits/nbPages; /1/indexes/*/objects returns only `results`.
          if (retrieveObjects) {
            var objectResults = data[transportParameters.responseKey] || [];
            self.numFound = objectResults.length;
            self.nbPages = 1;
          } else {
            self.numFound = data.nbHits;
            self.nbPages = data.nbPages;
          }

          var parseDoc = function (doc) {
            var options = {
              fieldList: self.fieldList,
            };
            return new AlgoliaDocFactory(doc, options);
          };

          let mappedDocs = [];

          function docMapper(algoliaDoc) {
            return Object.assign({}, algoliaDoc, {
              id: algoliaDoc.objectID,
            });
          }

          data[transportParameters.responseKey].forEach(function (item) {
            mappedDocs.push(docMapper(item));
          });

          utilsSvc.safeForEach(mappedDocs, function (mappedDoc) {
            const doc = parseDoc(mappedDoc);
            self.docs.push(doc);
          });
        },
        function error(msg) {
          console.log('Error');
          activeQueries.count--;
          if (isAbortError(msg)) {
            throw msg;
          }
          self.inError = true;
          msg.searchError = 'Error with Algolia query or API endpoint. Review request manually.';
          throw msg;
        },
      )
      .catch(function (response) {
        console.debug('Failed to execute search: ' + response.type + ':' + response.message);
        throw response;
      });
  } // end of search()

  // Return factory object
  return Searcher;
}


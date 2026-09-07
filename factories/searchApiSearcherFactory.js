'use strict';

import { isAbortError, transportRequestOpts } from '../services/transportRequestOpts.js';

export function SearchApiSearcherFactory(
  SearchApiDocFactory,
  activeQueries,
  searchApiSearcherPreprocessorSvc,
  esUrlSvc,
  SearcherFactory,
  transportSvc,
  utilsSvc,
) {
  var Searcher = function (options) {
    SearcherFactory.call(this, options, searchApiSearcherPreprocessorSvc);
  };

  Searcher.prototype = Object.create(SearcherFactory.prototype);
  Searcher.prototype.constructor = Searcher; // Reset the constructor

  Searcher.prototype.addDocToGroup = addDocToGroup;
  Searcher.prototype.pager = pager;
  Searcher.prototype.search = search;

  function addDocToGroup(_groupedBy, _group, _searchApiDoc) {
    console.log('addDocToGroup');
  }

  // Other factories return a new searcher for the next page, or null when there is no
  // next page (see esSearcherFactory, solrSearcherFactory, algoliaSearchFactory). Unlike
  // those, Search API has no fixed pagination convention (offset, cursor, ...) across
  // arbitrary target APIs, so this defers to a caller-supplied
  // config.nextPageArgsMapper(args, numberOfRows) - the same mapper-on-config pattern as
  // docsMapper/numberOfResultsMapper below, just for "what are the next page's args"
  // instead of "how do I read this response". No mapper configured, or the mapper itself
  // reporting there's no more (a falsy return), both mean null - same contract as every
  // other factory's pager().
  //
  // GET note (shared with esSearcherFactory's own pager()): prepareGetRequest bakes the
  // querystring into searcher.url in place rather than leaving it pristine like
  // solr/esSearcherPreprocessorSvc do, so a GET searcher's self.url is no longer the base
  // URL by the time a second pager() call reads it - the next page's params get appended
  // on top of the first page's instead of replacing them. POST is unaffected
  // (preparePostRequest never touches searcher.url).
  function pager() {
    var self = this;

    if (typeof self.config.nextPageArgsMapper !== 'function') {
      return null;
    }

    var nextArgs;
    try {
      nextArgs = self.config.nextPageArgsMapper(
        utilsSvc.deepClone(self.args),
        self.config.numberOfRows,
      );
    } catch (error) {
      const errMsg = 'Attempting to run nextPageArgsMapper failed: ' + error;
      console.error(errMsg);
      throw new Error('MapperError: ' + errMsg);
    }

    if (!nextArgs) {
      return null; // no more results, per the mapper
    }

    var options = {
      fieldList: self.fieldList,
      hlFieldList: self.hlFieldList,
      url: self.url,
      args: nextArgs,
      queryText: self.queryText,
      config: self.config,
      type: self.type,
      HIGHLIGHTING_PRE: self.HIGHLIGHTING_PRE,
      HIGHLIGHTING_POST: self.HIGHLIGHTING_POST,
    };

    return new Searcher(options);
  }

  // search (execute the query) and produce results
  // to the returned future
  function search() {
    const self = this;
    var apiMethod = self.config.apiMethod;
    var proxyUrl = self.config.proxyUrl;
    var url = self.url;
    var uri = esUrlSvc.parseUrl(self.url);
    var transport = transportSvc.getTransport({ apiMethod: apiMethod, proxyUrl: proxyUrl });

    // maybe the url and the payload should be managed inside the transport?
    // i don't like how it's not more seamless what to do on a GET and a POST
    //if (apiMethod === 'GET') {
    //  esUrlSvc.setParams(uri, self.args);
    //}
    // i don't like that we just ignroe the payload on a GET even though it is passed in.
    var payload = self.queryDsl;
    //var baseUrl = solrUrlSvc.buildUrl(url, self.args);
    url = esUrlSvc.buildUrl(uri);

    //baseUrl = queryTemplateSvc.hydrate(baseUrl, self.queryText, {encodeURI: true, defaultKw: '""'});
    self.inError = false;

    var headers = esUrlSvc.getHeaders(uri, self.config.customHeaders);

    activeQueries.count++;
    return transport
      .query(url, payload, headers, transportRequestOpts(self.config))
      .then(
        function success(httpConfig) {
          const data = httpConfig.data;

          self.lastResponse = data;

          activeQueries.count--;

          if (self.config.numberOfResultsMapper === undefined) {
            console.warn(
              'No numberOfResultsMapper defined so can not populate the number of results found.',
            );
          } else {
            try {
              self.numFound = self.config.numberOfResultsMapper(data);
            } catch (error) {
              const errMsg = 'Attempting to run numberOfResultsMapper failed: ' + error;
              console.error(errMsg);
              throw new Error('MapperError: ' + errMsg);
            }
          }

          var parseDoc = function (doc) {
            var options = {
              fieldList: self.fieldList,
            };
            return new SearchApiDocFactory(doc, options);
          };

          let mappedDocs = [];
          if (self.config.docsMapper === undefined) {
            console.warn('No docsMapper defined so can not populate individual docs.');
          } else {
            try {
              mappedDocs = self.config.docsMapper(data);
            } catch (error) {
              const errMsg = 'Attempting to run docsMapper failed: ' + error;
              console.error(errMsg);
              throw new Error('MapperError: ' + errMsg);
            }
          }

          if (self.config.numberOfRows && mappedDocs.length > self.config.numberOfRows) {
            mappedDocs = mappedDocs.slice(0, self.config.numberOfRows);
          }

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
          msg.searchError = 'Error with Search API query or server. Review request manually.';
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

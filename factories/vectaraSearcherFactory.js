'use strict';

import { isAbortError, transportRequestOpts } from '../services/transportRequestOpts.js';

export function VectaraSearcherFactory(
  VectaraDocFactory,
  activeQueries,
  vectaraSearcherPreprocessorSvc,
  vectaraUrlSvc,
  SearcherFactory,
  transportSvc,
  utilsSvc,
) {
  var Searcher = function (options) {
    SearcherFactory.call(this, options, vectaraSearcherPreprocessorSvc);
  };

  Searcher.prototype = Object.create(SearcherFactory.prototype);
  Searcher.prototype.constructor = Searcher; // Reset the constructor

  Searcher.prototype.addDocToGroup = addDocToGroup;
  Searcher.prototype.pager = pager;
  Searcher.prototype.search = search;

  function addDocToGroup(groupedBy, group, vectaraDoc) {
    const self = this;

    if (!Object.hasOwn(self.grouped, groupedBy)) {
      self.grouped[groupedBy] = [];
    }

    var found = null;
    utilsSvc.safeForEach(self.grouped[groupedBy], function (groupedDocs) {
      if (groupedDocs.value === group && !found) {
        found = groupedDocs;
      }
    });

    if (!found) {
      found = { docs: [], value: group };
      self.grouped[groupedBy].push(found);
    }

    found.docs.push(vectaraDoc);
  }

  // return a new searcher that will give you
  // the next page upon search(). To get the subsequent
  // page, call pager on that searcher
  function pager() {
    const self = this;
    let pagerArgs = {};
    let nextArgs = utilsSvc.deepClone(self.args);

    if (Object.hasOwn(nextArgs, 'pager') && nextArgs.pager !== undefined) {
      pagerArgs = nextArgs.pager;
    } else if (Object.hasOwn(self, 'pagerArgs') && self.pagerArgs !== undefined) {
      pagerArgs = self.pagerArgs;
    }

    // Vectara's v1 query API does not return a total match count in its
    // response, so we cannot rely on self.numFound to know when to stop —
    // search() sets it to the size of the *current* page, not the total.
    // Detect end-of-results by checking whether the previous page came
    // back short: if the server returned fewer docs than we asked for,
    // there is nothing left to fetch.
    //
    // Pagination contract (start + numResults, no total) documented at:
    //   https://docs.vectara.com/docs/1.0/learn/semantic-search/enable-pagination
    if (pagerArgs.size && self.docs.length < pagerArgs.size) {
      return null;
    }

    if (Object.hasOwn(pagerArgs, 'from')) {
      pagerArgs.from = parseInt(pagerArgs.from) + pagerArgs.size;
    } else {
      pagerArgs.from = pagerArgs.size;
    }

    nextArgs.pager = pagerArgs;
    var options = {
      args: nextArgs,
      config: self.config,
      fieldList: self.fieldList,
      queryText: self.queryText,
      type: self.type,
      url: self.url,
    };

    return new Searcher(options);
  }

  // search (execute the query) and produce results
  // to the returned future
  function search() {
    const self = this;
    var apiMethod = 'POST';
    var proxyUrl = self.config.proxyUrl;
    var url = self.url;
    var transport = transportSvc.getTransport({ apiMethod: apiMethod, proxyUrl: proxyUrl });

    var queryDslWithPagerArgs = utilsSvc.deepClone(self.queryDsl);
    if (self.pagerArgs) {
      queryDslWithPagerArgs.from = self.pagerArgs.from;
      queryDslWithPagerArgs.size = self.pagerArgs.size;
    }

    self.inError = false;

    const headers = vectaraUrlSvc.getHeaders(self.config.customHeaders);

    activeQueries.count++;
    return transport
      .query(url, queryDslWithPagerArgs, headers, transportRequestOpts(self.config))
      .then(
        function success(httpConfig) {
          var data = httpConfig.data;
          activeQueries.count--;

          const documents =
            data.responseSet && data.responseSet.length > 0 ? data.responseSet[0].document : [];

          self.numFound = documents.length;

          var parseDoc = function (doc, groupedBy, group) {
            var options = {
              groupedBy: groupedBy,
              group: group,
              fieldList: self.fieldList,
              url: self.url,
            };

            return new VectaraDocFactory(doc, options);
          };

          utilsSvc.safeForEach(documents, function (docFromApi) {
            const doc = parseDoc(docFromApi);
            self.docs.push(doc);
          });
        },
        function error(msg) {
          activeQueries.count--;
          if (isAbortError(msg)) {
            throw msg;
          }
          self.inError = true;
          msg.searchError = 'Error with Vectara query or server. Review request manually.';
          throw msg;
        },
      )
      .catch(function (response) {
        console.debug('Failed to execute search');
        throw response;
      });
  } // end of search()

  // Return factory object
  return Searcher;
}

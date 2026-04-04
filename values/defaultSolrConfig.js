'use strict';

var defaultSolrConfig = {
  sanitize:     true,
  highlight:    true,
  debug:        true,
  numberOfRows: 10,
  escapeQuery:  true,
  apiMethod:    'JSONP'
};

angular.module('o19s.splainer-search')
  .value('defaultSolrConfig', defaultSolrConfig);

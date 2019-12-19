'use strict';

angular.module('o19s.splainer-search')
  .value('defaultSolrConfig', {
    sanitize:     true,
    highlight:    true,
    debug:        true,
    escapeQuery:  true,
    numberOfRows: 10,
    apiMethod:    'querystring',
  });

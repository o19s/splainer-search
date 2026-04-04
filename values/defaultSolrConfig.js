'use strict';

export var defaultSolrConfig = {
  sanitize: true,
  highlight: true,
  debug: true,
  numberOfRows: 10,
  escapeQuery: true,
  apiMethod: 'JSONP',
};

// Angular DI registration (removed in Phase 4)
if (typeof angular !== 'undefined') {
  angular.module('o19s.splainer-search').value('defaultSolrConfig', defaultSolrConfig);
}

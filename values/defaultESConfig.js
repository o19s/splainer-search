'use strict';

export var defaultESConfig = {
  sanitize: true,
  highlight: true,
  debug: true,
  escapeQuery: true,
  numberOfRows: 10,
  apiMethod: 'POST',
  version: '5.0',
};

// Angular DI registration (removed in Phase 4)
if (typeof angular !== 'undefined') {
  angular.module('o19s.splainer-search').value('defaultESConfig', defaultESConfig);
}

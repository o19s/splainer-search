'use strict';

(function() {
  var defaultESConfig = {
    sanitize:     true,
    highlight:    true,
    debug:        true,
    escapeQuery:  true,
    numberOfRows: 10,
    apiMethod:    'POST',
    version:      '5.0'
  };

  angular.module('o19s.splainer-search')
    .value('defaultESConfig', defaultESConfig);
})();

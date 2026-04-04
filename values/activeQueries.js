'use strict';

export var activeQueries = {
  count: 0,
};

// Angular DI registration (removed in Phase 4)
if (typeof angular !== 'undefined') {
  angular.module('o19s.splainer-search').value('activeQueries', activeQueries);
}

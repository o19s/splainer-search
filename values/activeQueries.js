'use strict';

var activeQueries = {
  count: 0
};

angular.module('o19s.splainer-search')
  .value('activeQueries', activeQueries);

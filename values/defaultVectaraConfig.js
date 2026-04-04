'use strict';

export var defaultVectaraConfig = {
  apiMethod: 'POST',
};

// Angular DI registration (removed in Phase 4)
if (typeof angular !== 'undefined') {
  angular.module('o19s.splainer-search').value('defaultVectaraConfig', defaultVectaraConfig);
}

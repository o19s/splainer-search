'use strict';

// Resolves a set of ids to Normal docs
angular.module('o19s.splainer-search')
  .service('docResolverSvc', function docResolverSvc(ResolverFactory) {

  this.createResolver = function(ids, settings, chunkSize) {
    return new ResolverFactory(ids, settings, chunkSize);
  };

});

'use strict';

// Resolves a set of ids to Normal docs
export function docResolverSvcConstructor(ResolverFactory) {
  this.createResolver = function (ids, settings, chunkSize) {
    return new ResolverFactory(ids, settings, chunkSize);
  };
}

// Angular DI registration (removed in Phase 4)
if (typeof angular !== 'undefined') {
  angular
    .module('o19s.splainer-search')
    .service('docResolverSvc', ['ResolverFactory', docResolverSvcConstructor]);
}

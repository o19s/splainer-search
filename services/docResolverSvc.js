'use strict';

// Resolves a set of ids to Normal docs
export function docResolverSvcConstructor(ResolverFactory) {
  this.createResolver = function (ids, settings, chunkSize) {
    return new ResolverFactory(ids, settings, chunkSize);
  };
}

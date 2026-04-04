'use strict';

/*jslint latedef:false*/

export function TransportFactory() {
  var Transporter = function (opts) {
    var self = this;

    self.options = options;

    function options() {
      return opts;
    }
  };

  // Return factory object
  return Transporter;
}

// Angular DI registration (removed in Phase 4)
if (typeof angular !== 'undefined') {
  angular.module('o19s.splainer-search').factory('TransportFactory', [TransportFactory]);
}

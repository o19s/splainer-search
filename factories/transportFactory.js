'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('o19s.splainer-search')
    .factory('TransportFactory', [TransportFactory]);

  function TransportFactory() {
    var Transporter = function(opts) {
      var self                = this;

      self.options = options;

      function options() {
        return opts;
      }

    };

    // Return factory object
    return Transporter;
  }
})();

'use strict';

angular.module('o19s.splainer-search')
  .service('esExplainExtractorSvc', [
    'normalDocsSvc',
    function esExplainExtractorSvc(normalDocsSvc) {
      var self = this;

      // Functions
      self.docsWithExplainOther = docsWithExplainOther;

      function docsWithExplainOther(docs, fieldSpec) {
        var parsedDocs = [];

        angular.forEach(docs, function(doc) {
          var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
          parsedDocs.push(normalDoc);
        });

        return parsedDocs;
      }
    }
  ]);

'use strict';

angular.module('o19s.splainer-search')
  .service('esExplainExtractorSvc', [
    'normalDocsSvc',
    'utilsSvc',
    function esExplainExtractorSvc(normalDocsSvc, utilsSvc) {
      var self = this;

      // Functions
      self.docsWithExplainOther = docsWithExplainOther;

      function docsWithExplainOther(docs, fieldSpec) {
        var parsedDocs = [];

        utilsSvc.safeForEach(docs, function(doc) {
          var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
          parsedDocs.push(normalDoc);
        });

        return parsedDocs;
      }
    }
  ]);

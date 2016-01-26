'use strict';

angular.module('o19s.splainer-search')
  .service('solrExplainExtractorSvc', [
    'normalDocsSvc',
    function solrExplainExtractorSvc(normalDocsSvc) {
      var self = this;

      // Functions
      self.getOverridingExplain   = getOverridingExplain;
      self.docsWithExplainOther   = docsWithExplainOther;

      function getOverridingExplain(doc, fieldSpec, explainData) {
        var idFieldName = fieldSpec.id;
        var id          = doc[idFieldName];

        if (id && explainData && explainData.hasOwnProperty(id)) {
          return explainData[id];
        }

        return null;
      }

      function docsWithExplainOther(docs, fieldSpec, explainData) {
        var parsedDocs = [];

        angular.forEach(docs, function(doc) {
          var overridingExplain = self.getOverridingExplain(doc, fieldSpec, explainData);
          var normalDoc         = normalDocsSvc.createNormalDoc(fieldSpec, doc, overridingExplain);

          parsedDocs.push(normalDoc);
        });

        return parsedDocs;
      }
    }
  ]);

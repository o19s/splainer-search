esExplain = {
        "value": 0.039659735,
        "description": "function score, product of:",
        "details": [{
          "value": 1.1995022,
          "description": "product of:",
          "details": [{
            "value": 1.5993363,
            "description": "sum of:",
            "details": [{
              "value": 0.74043345,
              "description": "max of:",
              "details": [{
                "value": 0.74043345,
                "description": "weight(text:foo^10.0 in 6351) [PerFieldSimilarity], result of:",
                "details": [{
                  "value": 0.74043345,
                  "description": "score(doc=6351,freq=1.0), product of:",
                  "details": [{
                    "value": 0.28293502,
                    "description": "queryWeight, product of:",
                    "details": [{
                      "value": 10.0,
                      "description": "boost"
                    }, {
                      "value": 8.374315,
                      "description": "idf(docFreq=7, maxDocs=12756)"
                    }, {
                      "value": 0.003378605,
                      "description": "queryNorm"
                    }]
                  }, {
                    "value": 2.6169734,
                    "description": "fieldWeight in 6351, product of:",
                    "details": [{
                      "value": 1.0,
                      "description": "tf(freq=1.0), with freq of:",
                      "details": [{
                        "value": 1.0,
                        "description": "termFreq=1.0"
                      }]
                    }, {
                      "value": 8.374315,
                      "description": "idf(docFreq=7, maxDocs=12756)"
                    }, {
                      "value": 0.3125,
                      "description": "fieldNorm(doc=6351)"
                    }]
                  }]
                }]
              }]
            }]
          }, {
            "value": 0.75,
            "description": "coord(3/4)"
          }]
        }, {
          "value": 0.033063494,
          "description": "Math.min of",
          "details": [{
            "value": 0.033063494,
            "description": "Function for field created_at:",
            "details": [{
              "value": 0.033063494,
              "description": "exp(- MIN[Math.max(Math.abs(1.399894202E12(=doc value) - 1.450890423697E12(=origin))) - 0.0(=offset), 0)] * 6.68544734336367E-11)"
            }]
          }, {
            "value": 3.4028235E38,
            "description": "maxBoost"
          }]
        }, {
          "value": 1.0,
          "description": "queryBoost"
        }]
      }



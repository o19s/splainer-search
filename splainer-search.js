angular.module('o19s.splainer-search', []);

'use strict';

// Executes a solr search and returns
// a set of queryDocs
angular.module('o19s.splainer-search')
  .service('baseExplainSvc', function explainSvc(vectorSvc) {

    this.Explain = function(explJson, explFactory) {
      var datExplain = this;
      this.asJson = explJson;
      this.realContribution = this.score = parseFloat(explJson.value);
      this.realExplanation = this.description = explJson.description;
      var details = [];
      if (explJson.hasOwnProperty('details')) {
        details = explJson.details;
      }
      this.children = [];
      angular.forEach(details, function(detail) {
        datExplain.children.push(explFactory(detail));
      });

      /* Each explain defines influencers, 
       *
       * whatever this explain feels should be
       * plucked out of the explJson passed in as a list
       * of things that explain it
       * */
      this.influencers = function() {
        return [];
      };

      /* Each explain reports its contribution
       * */
      this.contribution = function() {
        return this.realContribution;
      };

      /* Each explain reports a more human-readable form
       * of the explain text that hopefully is less search geeky
       * */
      this.explanation = function() {
        return this.realExplanation;
      };

      /* Once we get to "matches" we intend to 
       * stop, and the level below becomes heavily related to 
       * similarity implementations (how does the tf * idf calculation work)
       * we'll call that out seperately to keep things sane
       * */
      this.hasMatch = function() {
        return false;
      };

      /* Return my influencers as a vector
       * where magnitude of each dimension is how 
       * much I am influenced by that influencer
       *
       * IE if I am a SumExplain, my vector is likely to be
       * for matches x and y with scores a and y respectively
       *
       *  a * x + b * y
       *
       *  here a and b are constants, x and y are other 
       *  matches to be recursively expanded
       *
       * */
      this.vectorize = function() {
        var rVal = vectorSvc.create();
        // base vector is just a, no expansion farther down
        // so any children's expansion will get ignored
        rVal.set(this.explanation(), this.contribution());
        return rVal;
      };

      var mergeInto = function(sink, source) {
        for (var attrname in source) { sink[attrname] = source[attrname]; }
        return sink;
      };
      this.matchDetails = function() {
        var rVal = {};
        angular.forEach(this.children, function(child) {
          mergeInto(rVal, child.matchDetails());
        });
        return rVal;
      };

      /* A friendly, hiererarchical view
       * of all the influencers
       * */
      var asStr = '';
      var asRawStr = '';
      this.toStr = function(depth) {
        if (asStr === '') {
          if (depth === undefined) {
            depth = 0;
          }
          var prefix = new Array(2 * depth).join(' ');
          var me = prefix + this.contribution() + ' ' + this.explanation() + '\n';
          var childStrs = [];
          angular.forEach(this.influencers(), function(child) {
            childStrs.push(child.toStr(depth+1));
          });
          asStr = me + childStrs.join('\n');
        }
        return asStr;
      };

      this.rawStr = function() {
        /* global JSON */
        if (asRawStr === '') {
          asRawStr = JSON.stringify(this.asJson);
        }
        return asRawStr;
      };
    };
  });

'use strict';

/* Some browsers and PhantomJS don't support bind, mozilla provides
 * this implementation as a monkey patch on Function.prototype
 *
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind?redirectlocale=en-US&redirectslug=JavaScript%2FReference%2FGlobal_Objects%2FFunction%2Fbind
 */

if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== 'function') {
      // closest thing possible to the ECMAScript 5 internal IsCallable function
      throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
    }

    var aArgs = Array.prototype.slice.call(arguments, 1),
        fToBind = this,
        FNOP = function () {},
        fBound = function () {
          return fToBind.apply(this instanceof FNOP && oThis ? this
                              : oThis,
                               aArgs.concat(Array.prototype.slice.call(arguments)));
        };

    FNOP.prototype = this.prototype;
    fBound.prototype = new FNOP();

    return fBound;
  };
}

'use strict';

angular.module('o19s.splainer-search')
  .service('esSearchSvc', function esSearchSvc($http) {

      //baseUrl = baseUrl.replace(/#\$query##/g, encodeURIComponent(queryText));
    var replaceQuery = function(esArgs, queryText) {
      var replaced = {};
      angular.forEach(esArgs, function(value, key) {
        if (typeof(value) === 'object') {
          replaced[key] = replaceQuery(value, queryText);
        } else if (typeof(value) === 'string') {
          replaced[key] = value.replace(/#\$query##/g, queryText);
        } else {
          replaced[key] = value;
        }
      }); 
      return replaced;
    };
  
 
    var EsSearcher = function(fieldList, esUrl, esArgs, queryText) {
    
      //TODO -- this.callUrl and this.linkUrl
      this.docs = [];
      this.numFound = 0;
      this.inError = false;

      var queryDsl = replaceQuery(esArgs, queryText);
      queryDsl.fields = fieldList;
      queryDsl.explain = true;

      this.search = function() {
        this.inError = false;
        var promise = Promise.create(this.search);
        var that = this;

        $http.post(esUrl, queryDsl).success(function(data) {
          that.numFound = data.hits.total;

          angular.forEach(data.hits.hits, function(hit) {
            var doc = {};
            // stringify fields
            angular.forEach(hit.fields, function(fieldValue, fieldName) {
              if (fieldValue.length === 1 && typeof(fieldValue) === 'object') {
                doc[fieldName] = fieldValue[0];
              } else {
                doc[fieldName] = fieldValue;
              }
            });

            // TODO doc.url, doc.explain, doc.highlight
            doc.explain = function() {
              if (hit.hasOwnProperty('_explanation')) {
                return hit._explanation;
              }
              else {
                return null;
              }
            };
            doc.url = function() {
              return '#';
            };
            doc.highlight = function() {
              return null;
            };
            that.docs.push(doc);
          });
          promise.complete();
        })
        .error(function() {
          that.inError = true;
          promise.complete();
        });

        return promise;
      };

    };

    this.createSearcher = function(fieldList, esUrl, esArgs, queryText) {
      return new EsSearcher(fieldList, esUrl, esArgs, queryText);
    };
  
  });

'use strict';

// Factory for explains
// really ties the room together
angular.module('o19s.splainer-search')
  .service('explainSvc', function explainSvc(baseExplainSvc, queryExplainSvc, simExplainSvc) {

    var Explain = baseExplainSvc.Explain;
    var ConstantScoreExplain = queryExplainSvc.ConstantScoreExplain;
    var MatchAllDocsExplain = queryExplainSvc.MatchAllDocsExplain;
    var WeightExplain = queryExplainSvc.WeightExplain;
    var FunctionQueryExplain = queryExplainSvc.FunctionQueryExplain;
    var DismaxTieExplain = queryExplainSvc.DismaxTieExplain;
    var DismaxExplain = queryExplainSvc.DismaxExplain;
    var SumExplain = queryExplainSvc.SumExplain;
    var CoordExplain = queryExplainSvc.CoordExplain;
    var ProductExplain = queryExplainSvc.ProductExplain;

    var FieldWeightExplain = simExplainSvc.FieldWeightExplain;
    var QueryWeightExplain = simExplainSvc.QueryWeightExplain;
    var DefaultSimTfExplain = simExplainSvc.DefaultSimTfExplain;
    var DefaultSimIdfExplain = simExplainSvc.DefaultSimIdfExplain;
    var ScoreExplain = simExplainSvc.ScoreExplain;

    var meOrOnlyChild = function(explain) {
      var infl = explain.influencers();
      if (infl.length === 1) {
        return infl[0]; //only child
      } else {
        return explain;
      }
    };

    var replaceBadJson = function(explJson) {
      var explJsonIfBad = {
        details: [],
        description: 'no explain for doc',
        value: 0.0,
        match: true
      };
      if (!explJson) {
        return explJsonIfBad;
      } else {
        return explJson;
      }
    };

    var tieRegex = /max plus ([0-9.]+) times/;
    var createExplain = function(explJson) {
      explJson = replaceBadJson(explJson);
      var base = new Explain(explJson, createExplain);
      var description = explJson.description;
      var details = [];
      var tieMatch = description.match(tieRegex);
      if (explJson.hasOwnProperty('details')) {
        details = explJson.details;
      }
      if (description.startsWith('score(')) {
        ScoreExplain.prototype = base;
        return new ScoreExplain(explJson);
      }
      if (description.startsWith('tf(')) {
        DefaultSimTfExplain.prototype = base;
        return new DefaultSimTfExplain(explJson);
      }
      else if (description.startsWith('idf(')) {
        DefaultSimIdfExplain.prototype = base;
        return new DefaultSimIdfExplain(explJson);
      }
      else if (description.startsWith('fieldWeight')) {
        FieldWeightExplain.prototype = base;
        return new FieldWeightExplain(explJson);
      }
      else if (description.startsWith('queryWeight')) {
        QueryWeightExplain.prototype = base;
        return new QueryWeightExplain(explJson);
      }
      if (description.startsWith('ConstantScore')) {
        ConstantScoreExplain.prototype = base;
        return new ConstantScoreExplain(explJson);
      }
      else if (description.startsWith('MatchAllDocsQuery')) {
        MatchAllDocsExplain.prototype = base;
        return new MatchAllDocsExplain(explJson);
      }
      else if (description.startsWith('weight(')) {
        WeightExplain.prototype = base;
        return new WeightExplain(explJson);
      }
      else if (description.startsWith('FunctionQuery')) {
        FunctionQueryExplain.prototype = base;
        return new FunctionQueryExplain(explJson);
      }
      else if (tieMatch && tieMatch.length > 1) {
        var tie = parseFloat(tieMatch[1]);
        DismaxTieExplain.prototype = base;
        return new DismaxTieExplain(explJson, tie);
      }
      else if (description.hasSubstr('max of')) {
        DismaxExplain.prototype = base;
        return meOrOnlyChild(new DismaxExplain(explJson));
      }
      else if (description.hasSubstr('sum of')) {
        SumExplain.prototype = base;
        return meOrOnlyChild(new SumExplain(explJson));
      }
      else if (description.hasSubstr('product of')) {
        var coordExpl = null;
        if (details.length === 2) {
          angular.forEach(details, function(detail) {
            if (detail.description.startsWith('coord(')) {
              CoordExplain.prototype = base;
              coordExpl = new CoordExplain(explJson, parseFloat(detail.value));
            }
          });
        }
        if (coordExpl !== null) {
          return coordExpl;
        } else {
          ProductExplain.prototype = base;
          return meOrOnlyChild(new ProductExplain(explJson));
        }
      }
      return base;

    };
    
    this.createExplain = function(explJson) {
      return createExplain(explJson);
    };


  });

'use strict';

angular.module('o19s.splainer-search')
  .service('fieldSpecSvc', function fieldSpecSvc() {
    // AngularJS will instantiate a singleton by calling 'new' on this function
    
    var addFieldOfType = function(fieldSpec, fieldType, fieldName) {
      if (fieldType === 'sub') {
        if (!fieldSpec.hasOwnProperty('subs')) {
          fieldSpec.subs = [];
        }
        if (fieldSpec.subs !== '*') {
          fieldSpec.subs.push(fieldName);
        } 
        if (fieldName === '*') {
          fieldSpec.subs = '*';
        }
      }
      else if (!fieldSpec.hasOwnProperty(fieldType)) {
        fieldSpec[fieldType] = fieldName;
      }
      fieldSpec.fields.push(fieldName);
    };

    // Populate field spec from a field spec string
    var populateFieldSpec = function(fieldSpec, fieldSpecStr) {
      var fieldSpecs = fieldSpecStr.split(/[\s,]+/);
      angular.forEach(fieldSpecs, function(aField) {
        var typeAndField = aField.split(':');
        var fieldType = null;
        var fieldName = null;
        if (typeAndField.length === 2) {
          fieldType = typeAndField[0];
          fieldName = typeAndField[1];
        }
        else if (typeAndField.length === 1) {
          fieldName = typeAndField[0];
          if (fieldSpec.hasOwnProperty('title')) {
            fieldType = 'sub';
          }
          else {
            fieldType = 'title';
          }
        }
        if (fieldType && fieldName) {
          addFieldOfType(fieldSpec, fieldType, fieldName);
        }
      });
    };
    
    
    var FieldSpec = function(fieldSpecStr) {
      this.fields = [];
      this.fieldSpecStr = fieldSpecStr;
      populateFieldSpec(this, fieldSpecStr);
      if (!this.hasOwnProperty('id')) {
        this.id = 'id';
        this.fields.push('id');
      }

      if (!this.hasOwnProperty('title')) {
        this.title = this.id;
      }

      this.fieldList = function() {
        if (this.hasOwnProperty('subs') && this.subs === '*') {
          return '*';
        }
        var rVal = [this.id];
        this.forEachField(function(fieldName) {
          rVal.push(fieldName);
        });
        return rVal;
      };

      // Execute innerBody for each (non id) field
      this.forEachField = function(innerBody) {
        if (this.hasOwnProperty('title')) {
          innerBody(this.title);
        }
        if (this.hasOwnProperty('thumb')) {
          innerBody(this.thumb);
        }
        angular.forEach(this.subs, function(sub) {
          innerBody(sub);
        });
      };
    };

    var transformFieldSpec = function(fieldSpecStr) {
      var defFieldSpec = 'id:id title:id *';
      var fieldSpecs = fieldSpecStr.split(/[\s,]+/);
      if (fieldSpecStr.trim().length === 0) {
        return defFieldSpec;
      }
      if (fieldSpecs[0] === '*') {
        return defFieldSpec;
      }
      return fieldSpecStr;
    };

    this.createFieldSpec = function(fieldSpecStr) {
      fieldSpecStr = transformFieldSpec(fieldSpecStr);
      return new FieldSpec(fieldSpecStr);
    };

  });

'use strict';

// Deals with normalizing documents from solr
// into a canonical representation, ie
// each doc has an id, a title, possibly a thumbnail field
// and possibly a list of sub fields
angular.module('o19s.splainer-search')
  .service('normalDocsSvc', function normalDocsSvc(explainSvc) {

    var assignSingleField = function(normalDoc, solrDoc, solrField, toProperty) {
      if (solrDoc.hasOwnProperty(solrField)) {
        normalDoc[toProperty] = ('' + solrDoc[solrField]);
      }
    };

    var assignFields = function(normalDoc, solrDoc, fieldSpec) {
      assignSingleField(normalDoc, solrDoc, fieldSpec.id, 'id');
      assignSingleField(normalDoc, solrDoc, fieldSpec.title, 'title');
      assignSingleField(normalDoc, solrDoc, fieldSpec.thumb, 'thumb');
      normalDoc.subs = {};
      if (fieldSpec.subs === '*') {
        angular.forEach(solrDoc, function(value, fieldName) {
          if (typeof(value) !== 'function') {
            if (fieldName !== fieldSpec.id && fieldName !== fieldSpec.title &&
                fieldName !== fieldSpec.thumb) {
              normalDoc.subs[fieldName] = '' + value;
            }
          }
        });
      }
      else {
        angular.forEach(fieldSpec.subs, function(subFieldName) {
          if (solrDoc.hasOwnProperty(subFieldName)) {
            normalDoc.subs[subFieldName] = '' + solrDoc[subFieldName];
          }
        });
      }
    };

    // A document within a query
    var NormalDoc = function(fieldSpec, solrDoc) {
      this.solrDoc = solrDoc;
      assignFields(this, this.solrDoc.source(), fieldSpec);
      var hasThumb = false;
      if (this.hasOwnProperty('thumb')) {
        hasThumb = true;
      }
      this.subsList = [];
      var thisNormalDoc = this;
      angular.forEach(this.subs, function(subValue, subField) {
        var expanded = {field: subField, value: subValue};
        thisNormalDoc.subsList.push(expanded);
      });

      this.hasThumb = function() {
        return hasThumb;
      };
      
      this.url = function() {
        return this.solrDoc.url(fieldSpec.id, this.id);
      };

    };

    // layer on highlighting features
    var snippitable = function(doc) {
      var solrDoc = doc.solrDoc;
      
      var lastSubSnips = {};
      var lastHlPre = null;
      var lastHlPost = null;
      doc.subSnippets = function(hlPre, hlPost) {
        if (lastHlPre !== hlPre || lastHlPost !== hlPost) {
          angular.forEach(doc.subs, function(subFieldValue, subFieldName) {
            var snip = solrDoc.highlight(doc.id, subFieldName, hlPre, hlPost);
            if (snip === null) {
              snip = subFieldValue.slice(0, 200);
            }
            lastSubSnips[subFieldName] = snip;
          });
        }
        return lastSubSnips;
      };
      return doc;
    };

    // layer on explain features
    var explainable = function(doc, explainJson) {

      var simplerExplain = null;// explainSvc.createExplain(explainJson);
      var hotMatches = null;//simplerExplain.vectorize();
      var matchDetails = null;

      var initExplain = function() {
        if (!simplerExplain) {
          simplerExplain = explainSvc.createExplain(explainJson);
          hotMatches = simplerExplain.vectorize();
          matchDetails = simplerExplain.matchDetails();
        }
      };

      doc.explain = function() {
        initExplain();
        return simplerExplain;
      };
      
      doc.hotMatches = function() {
        initExplain();
        return hotMatches;
      };

      doc.matchDetails = function() {
        initExplain();
        return matchDetails;
      };

      var hotOutOf = [];
      var lastMaxScore = -1;
      doc.hotMatchesOutOf = function(maxScore) {
        initExplain();
        if (maxScore !== lastMaxScore) {
          hotOutOf.length = 0;
        }
        lastMaxScore = maxScore;
        if (hotOutOf.length === 0) {
          angular.forEach(hotMatches.vecObj, function(value, key) {
            var percentage = ((0.0 + value) / maxScore) * 100.0;
            hotOutOf.push({description: key, metadata: matchDetails[key], percentage: percentage});
          });
          hotOutOf.sort(function(a,b) {return b.percentage - a.percentage;});
        }
        return hotOutOf;
      };

      doc.score = function() {
        initExplain();
        return simplerExplain.contribution();
      };
      return doc;
    };

    this.createNormalDoc = function(fieldSpec, solrDoc) {
      var nDoc = new NormalDoc(fieldSpec, solrDoc);
      return this.snippetDoc(this.explainDoc(nDoc, solrDoc.explain(nDoc.id)));
    };

    // Decorate doc with an explain/field values/etc other
    // than what came back from Solr
    this.explainDoc = function(doc, explainJson) {
      var decorated = angular.copy(doc);
      return explainable(decorated, explainJson);
    };

    this.snippetDoc = function(doc) {
      var decorated = angular.copy(doc);
      return snippitable(decorated);
    };

    // A stub, used to display a result that we expected 
    // to find in Solr, but isn't there
    this.createPlaceholderDoc = function(docId, stubTitle, explainJson) {
      var placeHolder = {id: docId,
                         title: stubTitle};
      if (explainJson) {
        return explainable(placeHolder, explainJson);
      } else {
        return placeHolder;
      }
    };

  
  });

'use strict';
// basic promise
(function() {
  var Promise = function(taskFn, taskThis, taskArgs) {
    this.completed = false;
    // when taskFn signals done, do this
    this.$$myFn = taskFn;
    this.then = function(nextTaskFn, nextTaskThisOrArgs, nextTaskArgs) {
      if (nextTaskThisOrArgs instanceof Array) {
        nextTaskArgs = nextTaskThisOrArgs;
        nextTaskThisOrArgs = undefined;
      }
      this.next = new Promise(nextTaskFn, nextTaskThisOrArgs, nextTaskArgs);
      if (this.completed) {
        this.completer();
      }
      return this.next;
    };
    
    // Run the underlying task
    this.apply = function() {
      taskFn.promise = this; // somebody then(...) me!
      taskFn.apply(taskThis, taskArgs);
    };
    
    // We're done, the next thing can run
    this.completer = function() {
      this.completed = true;
      if (this.next) {
        this.next.apply();
        this.completed = false;
      }
    };
    this.complete = this.completer.bind(this);
  };

  Promise.create = function(func) {
    if (func.hasOwnProperty('promise')) {
      // I already have a stub promise waiting for 
      // somebody to call then on
      return func.promise;
    } else {
      var firstPromise = new Promise();
      return firstPromise;
    }
  };
  window.Promise = Promise;
}());

// I have an easier time thinking as an implementor
// in terms of a sequence of asynchronous tasks to be
// chained

'use strict';

// Explains that exist before you get to the match level
angular.module('o19s.splainer-search')
  .service('queryExplainSvc', function explainSvc(baseExplainSvc, vectorSvc, simExplainSvc) {
    var DefaultSimilarityMatch = simExplainSvc.DefaultSimilarityMatch;

    this.MatchAllDocsExplain = function() {
      this.realExplanation = 'You queried *:* (all docs returned w/ score of 1)';
    };
    
    this.ConstantScoreExplain = function() {
      this.realExplanation = 'Constant Scored Query';
    };

    this.WeightExplain = function(explJson) {
      // take weight(text:foo in 1234), extract text:foo,
      // this actually deliniates a "match" so the stuff 
      // underneath this level in the explain is search nerd trivia
      // tf, idf, norms, etc. 
      // We break that out separately, not part of the main explain
      // tree, but as a different hiererarchy
      var weightRegex = /weight\((.*?)\s+in\s+\d+?\)/;
      var description = explJson.description;
      
      var match = description.match(weightRegex);
      if (match !== null && match.length > 1) {
        this.realExplanation = match[1];
      } else {
        this.realExplanation = description;
      }

      this.hasMatch = function() {
        return true;
      };

      this.getMatch = function() {
        // Match has lots of goodies based on similarity used
        if (this.description.hasSubstr('DefaultSimilarity')) {
          return new DefaultSimilarityMatch(this.children);
        }
        return null;
      };

      this.explanation = function() {
        var match = this.getMatch();
        var matchStr = '';
        if (match !== null) {
          matchStr = '\n' + match.formulaStr();
        }
        return this.realExplanation;
      };

      this.matchDetails = function() {
        var rVal = {};
        rVal[this.explanation()] = this.rawStr(); //match.formulaStr();
        return rVal;
      };
    };

    this.FunctionQueryExplain = function(explJson) {
      var funcQueryRegex = /FunctionQuery\((.*)\)/;
      var description = explJson.description;
      var match = description.match(funcQueryRegex);
      if (match !== null && match.length > 1) {
        this.realExplanation = match[1];
      } else {
        this.realExplanation = description;
      }
    };

    this.CoordExplain = function(explJson, coordFactor) {
      if (coordFactor < 1.0) {
        this.realExplanation = 'Matches Punished by ' + coordFactor + ' (not all query terms matched)';

        this.influencers = function() {
          var infl = [];
          for (var i = 0; i < this.children.length; i++) {
            if (this.children[i].description.hasSubstr('coord')) {
              continue;
            } else {
              infl.push(this.children[i]);
            }
          }
          return infl;
        };

        this.vectorize = function() {
          // scale the others by coord factor
          var rVal = vectorSvc.create();
          angular.forEach(this.influencers(), function(infl) {
            rVal = vectorSvc.add(rVal, infl.vectorize());
          });
          rVal = vectorSvc.scale(rVal, coordFactor);
          return rVal;
        };
      }
    };

    this.DismaxTieExplain = function(explJson, tie) {
      this.realExplanation = 'Dismax (max plus:' + tie + ' times others';

      this.influencers = function() {
        var infl = angular.copy(this.children);
        infl.sort(function(a, b) {return b.score - a.score;});
        return infl;
      };

      this.vectorize = function() {
        var infl = this.influencers();
        // infl[0] is the winner of the dismax competition
        var rVal = infl[0].vectorize();
        angular.forEach(infl.slice(1), function(currInfl) {
          var vInfl = currInfl.vectorize();
          var vInflScaled = vectorSvc.scale(vInfl, tie);
          rVal = vectorSvc.add(rVal, vInflScaled);
        });
        return rVal;
      };
    };


    this.DismaxExplain = function() {
      this.realExplanation = 'Dismax (take winner of below)';
      
      this.influencers = function() {
        var infl = angular.copy(this.children);
        infl.sort(function(a, b) {return b.score - a.score;});
        return infl;
      };

      this.vectorize = function() {
        var infl = this.influencers();
        // Dismax, winner takes all, influencers
        // are sorted by influence
        return infl[0].vectorize();
      };
    };

    this.SumExplain = function() {
      this.realExplanation = 'Sum of the following:';
      this.isSumExplain = true;
      
      this.influencers = function() {
        var preInfl = angular.copy(this.children);
        // Well then the child is the real influencer, we're taking sum
        // of one thing
        preInfl.sort(function(a, b) {return b.score - a.score;});
        var infl = [];
        angular.forEach(preInfl, function(child) {
          // take advantage of commutative property
          if (child.hasOwnProperty('isSumExplain') && child.isSumExplain) {
            angular.forEach(child.influencers(), function(grandchild) {
              infl.push(grandchild);
            });
          } else {
            infl.push(child);
          }
        });
        return infl;
      };

      this.vectorize = function() {
        // vector sum all the components
        var rVal = vectorSvc.create();
        angular.forEach(this.influencers(), function(infl) {
          rVal = vectorSvc.add(rVal, infl.vectorize());
        });
        return rVal;
      };
    };

    this.ProductExplain = function() {
      this.realExplanation = 'Product of following:';

      var oneFilled = function(length) {
        return Array.apply(null, new Array(length)).map(Number.prototype.valueOf,1);
      };
      
      this.influencers = function() {
        var infl = angular.copy(this.children);
        infl.sort(function(a, b) {return b.score - a.score;});
        return infl;
      };
      this.vectorize = function() {
        // vector sum all the components
        var rVal = vectorSvc.create();

        var infl = this.influencers();

        var inflFactors = oneFilled(infl.length);

        for (var factorInfl = 0; factorInfl < infl.length; factorInfl++) {
          for (var currMult = 0; currMult < infl.length; currMult++) {
            if (currMult !== factorInfl) {
              inflFactors[factorInfl] = (inflFactors[factorInfl] * infl[currMult].contribution());
            }
          }
        }

        for (var currInfl = 0; currInfl < infl.length; currInfl++) {
          var i = infl[currInfl];
          var thisVec = i.vectorize();
          var thisScaledByOthers = vectorSvc.scale(thisVec, inflFactors[currInfl]);
          rVal = vectorSvc.add(rVal, thisScaledByOthers);
        }

        return rVal;
      };
    };

  });

'use strict';

// Explains that exist below the match level
// these have a lot to do with the similarity implementation used by Solr/Lucene
// Here we implement default similarity, we will need to split this out for
// more similarity types (ie sweet spot, bm25) as needed
angular.module('o19s.splainer-search')
  .service('simExplainSvc', function explainSvc() {

    this.DefaultSimilarityMatch = function(children) {
      var infl = children;
      if (children.length === 1 && children[0].explanation().startsWith('Score')) {
        infl = children[0].children;
      }

      this.fieldWeight = null;
      this.queryWeight = null;
      var match = this;
      angular.forEach(infl, function(child) {
        if (child.explanation() === 'Field Weight') {
          match.fieldWeight = child;
        } else if (child.explanation() === 'Query Weight') {
          match.queryWeight = child;
        }
      });

      this.formulaStr = function() {
        return 'TF=' + this.fieldWeight.tf().contribution() + 
               ' * IDF=' + this.fieldWeight.idf().contribution();
      };
    };

    var tfIdfable = function(explain) {
      var tfExpl = null;
      var idfExpl = null;
      angular.forEach(explain.children, function(child) {
        if (child.explanation().startsWith('Term')) {
          tfExpl = child;
        } else if (child.explanation().startsWith('IDF')) {
          idfExpl = child;
        }
      });

      explain.tf = function() {
        return tfExpl;
      };
      
      explain.idf = function() {
        return idfExpl;
      };
      return explain;
    };

    this.ScoreExplain = function() {
      this.realExplanation = 'Score';
    };

    this.FieldWeightExplain = function() {
      this.realExplanation = 'Field Weight';
      tfIdfable(this);

      /*this.fieldNorm = function() {
      };*/
    };
    
    this.QueryWeightExplain = function() {
      this.realExplanation = 'Query Weight';
      tfIdfable(this);
    };

    // For default similarity, tf in the score is actually
    // is sqrt(termFreq) where termFreq is the frequency of
    // a term in a document.
    this.DefaultSimTfExplain = function() {

      // Should have a single child with actual term frequency
      // Notes TODO:
      // 1. For strict phrase queries, ie "one two" this is
      //    phraseFreq, not a big deal just labeling
      // 2. For sloppy phrase queries gets more complicated,
      //     sloppyFreq is (1 / (distance + 1))
      //      where distance min distance in doc between "one ... two"
      //      for every set of phrases in document
      var termFreq = this.children[0].contribution();
      this.realExplanation = 'Term Freq Score (' + termFreq + ')';
    };

    // For default similarity, IDF of the term being searched
    // in the case of phrase queries, this is a sum of
    // all the members of the phrase. 
    //
    // TODO -- the underlying idf for each member of a phrase
    // does not identify the term corresponding to that idf,
    // Lucene patch?
    //
    // The formula for IDF in default similarity is
    //  1 + log( numDocs / (docFreq + 1))
    //
    // or taken the idf explanation:
    //   idf(docFreq=4743, maxDocs=20148)
    // in python:
    // >> 1 + log(20148.0 / (4753 + 1))
    //
    this.DefaultSimIdfExplain = function(explJson) {
      var desc = explJson.description;
      if (this.children.length > 1 && desc.hasSubstr('sum of:')) {
        // then each child is an idf explain
        this.realExplanation = 'IDF Score';
        this.influencers = function() {
          return this.children;
        };
      }
      else {
        var idfRegex = /idf\(docFreq=(\d+),.*maxDocs=(\d+)\)/;
        var matches = desc.match(idfRegex);
        if (matches !== null && matches.length > 1) {
          /*var docFreq = parseInt(matches[1], 10);
          var maxDocs = parseInt(matches[2], 10);*/
          this.realExplanation = 'IDF Score';
        }
        else {
          this.realExplanation = desc;
        }
      }
    };
});

'use strict';

// Executes a solr search and returns
// a set of solr documents
angular.module('o19s.splainer-search')
  .service('solrSearchSvc', function solrSearchSvc($http, solrUrlSvc) {
   
    // PRE and POST strings, can't just use HTML
    // because Solr doesn't appear to support escaping 
    // XML/HTML tags in the content. So we do this stupid thing 
    this.HIGHLIGHTING_PRE = 'aouaoeuCRAZY_STRING!8_______';
    this.HIGHLIGHTING_POST = '62362iueaiCRAZY_POST_STRING!_______';
    var svc = this;

    var activeQueries = 0;

    // a URL to access a the specified docId 
    var buildTokensUrl = function(fieldList, solrUrl, idField, docId) {
      var escId = encodeURIComponent(solrUrlSvc.escapeUserQuery(docId));
      var tokensArgs = {
        'indent': ['true'],
        'wt': ['xml'],
        //'q': [idField + ':' + escId],
        'facet': ['true'],
        'facet.field': [],
        'facet.mincount': ['1'],
      };
      if (fieldList !== '*') {
        angular.forEach(fieldList, function(fieldName) {
          if (fieldName !== 'score') {
            tokensArgs['facet.field'].push(fieldName);
          }
        });
      }
      return solrUrlSvc.buildUrl(solrUrl, tokensArgs) + '&q=' + idField + ':'  + escId;
    };

    // the full URL we'll use to call Solr
    var buildCallUrl = function(fieldList, solrUrl, solrArgs, queryText, config) {
      solrArgs.fl = (fieldList === '*') ? '*' : [fieldList.join(' ')];
      solrArgs.wt = ['json'];
      if (config.debug) {
        solrArgs.debug = ['true'];
        solrArgs['debug.explain.structured'] = ['true'];
      }
      if (config.highlight) {
        solrArgs.hl = ['true'];
        solrArgs['hl.simple.pre'] = [svc.HIGHLIGHTING_PRE];
        solrArgs['hl.simple.post'] = [svc.HIGHLIGHTING_POST];
      }
      var baseUrl = solrUrlSvc.buildUrl(solrUrl, solrArgs);
      baseUrl = baseUrl.replace(/#\$query##/g, encodeURIComponent(queryText));
      return baseUrl;
    };
    
    var withoutUnsupported = function(argsToUse, dontSanitize) {
      var argsRemoved = angular.copy(argsToUse);
      if (dontSanitize !== true) {
        solrUrlSvc.removeUnsupported(argsRemoved);
      }
      return argsRemoved;
    };

    var defaultConfig = {
      sanitize: true,
      highlight: true,
      debug: true
    };

    this.configFromDefault = function() {
      return angular.copy(defaultConfig);
    };


    var SolrSearcher = function(fieldList, solrUrl, solrArgs, queryText, config) {
      if (config === undefined) {
        config = defaultConfig;
      }
      this.callUrl = this.linkUrl = '';
      this.callUrl = buildCallUrl(fieldList, solrUrl, withoutUnsupported(solrArgs, !config.sanitize), queryText, config);
      this.linkUrl = this.callUrl.replace('wt=json', 'wt=xml');
      this.linkUrl = this.linkUrl + '&indent=true&echoParams=all';
      this.docs = [];
      this.grouped = {};
      this.numFound = 0;
      this.inError = false;

      this.addDocToGroup = function(groupedBy, group, solrDoc) {
        if (!this.grouped.hasOwnProperty(groupedBy)) {
          this.grouped[groupedBy] = [];
        }
        var found = null;
        angular.forEach(this.grouped[groupedBy], function(groupedDocs) {
          if (groupedDocs.value === group && !found) {
            found = groupedDocs;
          }
        });
        if (!found) {
          found = {docs:[], value:group};
          this.grouped[groupedBy].push(found);
        }
        found.docs.push(solrDoc);
      };

      // return a new searcher that will give you
      // the next page upon search(). To get the subsequent
      // page, call pager on that searcher ad infinidum
      this.pager = function() {
        var start = 0;
        var nextArgs = angular.copy(solrArgs);
        if (nextArgs.hasOwnProperty('start')) {
          start = parseInt(nextArgs.start) + 10;
          if (start >= this.numFound) {
            return null; // no more results
          }
        } else {
          start = 10;
        }
        var remaining = this.numFound - start;
        nextArgs.rows = ['' + Math.min(10, remaining)];
        nextArgs.start = ['' + start];
        var pageConfig = defaultConfig;
        pageConfig.sanitize = false;
        return new SolrSearcher(fieldList, solrUrl, nextArgs, queryText, pageConfig);
      };

      // search (execute the query) and produce results
      // to the returned future
      this.search = function() {
        var url = this.callUrl + '&json.wrf=JSON_CALLBACK';
        this.inError = false;
        
        var promise = Promise.create(this.search);
        var that = this;

        var getExplData = function(data) {
          if (data.hasOwnProperty('debug')) {
            var dbg = data.debug;
            if (dbg.hasOwnProperty('explain')) {
              return dbg.explain;
            }
          }
          return {};
        };

        var getHlData = function(data) {
          if (data.hasOwnProperty('highlighting')) {
            return data.highlighting;
          }
          return {};
        };

        activeQueries++;
        $http.jsonp(url).success(function(data) {
          activeQueries--;
          var explDict = getExplData(data);
          var hlDict = getHlData(data);
         
          var parseSolrDoc = function(solrDoc, groupedBy, group) {
            // annotate the doc with several methods
            var source = angular.copy(solrDoc);
            if (groupedBy === undefined) {
              groupedBy = null;
            }
            if (group === undefined) {
              group = null;
            }

            solrDoc.groupedBy = function() {
              return groupedBy;
            };

            solrDoc.group = function() {
              return group;
            };

            solrDoc.source = function() {
              return source;
            };

            solrDoc.url = function(idField, docId) {
              return buildTokensUrl(fieldList, solrUrl, idField, docId);
            };
            solrDoc.explain = function(docId) {
              if (explDict.hasOwnProperty(docId)) {
                return explDict[docId];
              } else {
                return null;
              }
            };

            solrDoc.snippet = function(docId, fieldName) {
              if (hlDict.hasOwnProperty(docId)) {
                var docHls = hlDict[docId];
                if (docHls.hasOwnProperty(fieldName)) {
                  return docHls[fieldName];
                }
              }
              return null;
            };

            solrDoc.highlight = function(docId, fieldName, preText, postText) {
              var fieldValue = this.snippet(docId, fieldName);
              if (fieldValue) {
                var esc = escapeHtml(fieldValue);
                
                var preRegex = new RegExp(svc.HIGHLIGHTING_PRE, 'g');
                var hlPre = esc.replace(preRegex, preText);
                var postRegex = new RegExp(svc.HIGHLIGHTING_POST, 'g');
                return hlPre.replace(postRegex, postText);
              } else {
                return null;
              }
            };
          };


          if (data.hasOwnProperty('response')) {
            angular.forEach(data.response.docs, function(solrDoc) {
              parseSolrDoc(solrDoc); 
              that.numFound = data.response.numFound;
              that.docs.push(solrDoc);
            });
          } else if (data.hasOwnProperty('grouped')) {
            angular.forEach(data.grouped, function(groupedBy, groupedByName) {
              that.numFound = groupedBy.matches;
              angular.forEach(groupedBy.groups, function(groupResp) {
                var groupValue = groupResp.groupValue;
                angular.forEach(groupResp.doclist.docs, function(solrDoc) {
                  parseSolrDoc(solrDoc, groupedByName, groupValue);
                  that.docs.push(solrDoc);
                  that.addDocToGroup(groupedByName, groupValue, solrDoc);
                });
              });
            });
          }
          
          promise.complete();
        }).error(function() {
          activeQueries--;
          that.inError = true;
          promise.complete();
        });
        return promise;

      };
    };

    this.createSearcherFromSettings = function(settings, queryText) {
      return new SolrSearcher(settings.createFieldSpec().fieldList(), settings.solrUrl,
                              settings.selectedTry.solrArgs, queryText);
    };

    this.createSearcher = function (fieldList, solrUrl, solrArgs, queryText, config) {
      return new SolrSearcher(fieldList, solrUrl, solrArgs, queryText, config);
    };

    this.activeQueries = function() {
      return activeQueries;
    };
   
    var entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '\"': '&quot;',
      '\'': '&#39;',
      '/': '&#x2F;'
    };

    var escapeHtml = function(string) {
      return String(string).replace(/[&<>"'\/]/g, function (s) {
        return entityMap[s];
      });
    };
  });

'use strict';

angular.module('o19s.splainer-search')
  .service('solrUrlSvc', function solrUrlSvc() {

    this.buildUrl = function(url, urlArgs) {
      var baseUrl = url + '?';
      baseUrl += this.formatSolrArgs(urlArgs);
      return baseUrl;
    };
   
    /* Given arguments of the form {q: ['*:*'], fq: ['title:foo', 'text:bar']}
     * turn into string suitable for URL query param q=*:*&fq=title:foo&fq=text:bar
     *
     * */
    this.formatSolrArgs = function(argsObj) {
      var rVal = '';
      angular.forEach(argsObj, function(values, param) {
        angular.forEach(values, function(value) {
          rVal += param + '=' + value + '&';
        });
      });
      // percentages need to be escaped before
      // url escaping
      rVal = rVal.replace(/%/g, '%25');
      return rVal.slice(0, -1); // take out last & or trailing ? if no args
    };

    /* Given string of the form [?]q=*:*&fq=title:foo&fq=title:bar
     * turn into object of the form:
     * {q:['*:*'], fq:['title:foo', 'title:bar']}
     *
     * */
    this.parseSolrArgs = function(argsStr) {
      var splitUp = argsStr.split('?');
      if (splitUp.length === 2) {
        argsStr = splitUp[1];
      }
      var vars = argsStr.split('&');
      var rVal = {};
      angular.forEach(vars, function(qVar) {
        var nameAndValue = qVar.split('=');
        if (nameAndValue.length === 2) {
          var name = nameAndValue[0];
          var value = nameAndValue[1];
          var decodedValue = decodeURIComponent(value);
          if (!rVal.hasOwnProperty(name)) {
            rVal[name] = [decodedValue];
          } else {
            rVal[name].push(decodedValue);
          }
        }
      });
      return rVal;
    };
    
    /* Parse a Solr URL of the form [/]solr/[collectionName]/[requestHandler]
     * return object with {collectionName: <collectionName>, requestHandler: <requestHandler>} 
     * return null on failure to parse as above solr url
     * */
    this.parseSolrPath = function(pathStr) {
      if (pathStr.startsWith('/')) {
        pathStr = pathStr.slice(1);
      }

      var pathComponents = pathStr.split('/');
      var pcLen = pathComponents.length;
      if (pcLen >= 2) {

        var reqHandler = pathComponents[pcLen - 1];
        var collection = pathComponents[pcLen - 2];
        return {requestHandler: reqHandler, collectionName: collection};
      }
      return null;
    };

    /* Parse a Sor URL of the form [http|https]://[host]/solr/[collectionName]/[requestHandler]?[args]
     * return null on failure to parse
     * */
    this.parseSolrUrl = function(solrReq) {

      var parseUrl = function(url) {
        // this is the crazy way you parse URLs in JS who am I to question the wisdom
        var a = document.createElement('a');
        a.href = url;
        return a;
      };

      var parsedUrl = parseUrl(solrReq);
      parsedUrl.solrArgs = this.parseSolrArgs(parsedUrl.search);
      var pathParsed = this.parseSolrPath(parsedUrl.pathname);
      if (pathParsed) {
        parsedUrl.collectionName = pathParsed.collectionName;
        parsedUrl.requestHandler = pathParsed.requestHandler;
      } else {
        return null;
      }
      var solrEndpoint = function() {
        return parsedUrl.protocol + '//' + parsedUrl.host + parsedUrl.pathname;
      };

      parsedUrl.solrEndpoint = solrEndpoint;
      return parsedUrl;

    };
    
    /*optionally escape user query text, ie 
     * q=punctuation:: clearly can't search for the 
     * term ":" (colon) because colon has meaning in the query syntax
     * so instead, you've got to search for
     * q=punctuation:\: 
     * */ 
    this.escapeUserQuery = function(queryText) {
      var escapeChars = ['+', '-', '&', '!', '(', ')', '[', ']',
                         '{', '}', '^', '"', '~', '*', '?', ':', '\\'];
      var regexp = new RegExp('(\\' + escapeChars.join('|\\') + ')', 'g');
      return queryText.replace(regexp, '\\$1');
    };

    /* This method is a bit tied to how the solrSearchSvc behaves, but 
     * as this module is probably what you're using to chop up a user's SolrURL
     * its placed here
     * 
     * It strips arguments out that are not supported by solrSearchSvc and
     * generally interfere with its operation (ie fl, rows, etc). solrSearchSvc
     * removes these itself, but this is placed here for convenience to remove
     * from user input (ie an fl may confuse the user when fl is actually supplied
     * elsewhere)
     * */
    this.removeUnsupported = function(solrArgs) {
        var warnings = {};
        var deleteThenWarn = function(arg, warning) {
          if (solrArgs.hasOwnProperty(arg)) {
            warnings[arg] = warning;
            delete solrArgs[arg];
          }
        };
        
        var deleteThenWarnPrefix = function(argPrefix, warning) {
          var argsCpy = angular.copy(solrArgs);
          angular.forEach(argsCpy, function(value, key) {
            if (key.startsWith(argPrefix)) {
              deleteThenWarn(key, warning);
            }
          });
        };
       
        // Stuff I think we can safely remove without warning the user 
        delete solrArgs.fl;
        delete solrArgs.wt;
        delete solrArgs.rows;
        delete solrArgs.debug;

        // Unsupported stuff to remove and provide a friendly warning
        // deleteThenWarnPrefix('group', 'Group queries/field collapsing not supported');
        return warnings;
    };

  });

'use strict';

if (typeof String.prototype.startsWith !== 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.indexOf(str) === 0;
  };
}

if (typeof String.prototype.hasSubstr !== 'function') {
  String.prototype.hasSubstr = function(str) {
    return this.indexOf(str) !== -1;
  };
}

if (typeof String.prototype.endsWith !== 'function') {
  String.prototype.endsWith = function(suffix) {
      return this.indexOf(suffix, this.length - suffix.length) !== -1;
  };
}

'use strict';

/*
 * Basic vector operations used by explain svc
 *
 * */
angular.module('o19s.splainer-search')
  .service('vectorSvc', function vectorSvc() {

    var SparseVector = function() {
      this.vecObj = {};

      var asStr = '';
      var setDirty = function() {
        asStr = '';
      };

      this.set = function(key, value) {
        this.vecObj[key] = value;
        setDirty();
      };

      this.get = function(key) {
        if (this.vecObj.hasOwnProperty(key)) {
          return this.vecObj[key];
        }
        return undefined;
      };

      this.toStr = function() {
        // memoize the toStr conversion
        if (asStr === '') {
          // sort
          var sortedL = [];
          angular.forEach(this.vecObj, function(value, key) {
            sortedL.push([key, value]);
          });
          sortedL.sort(function(lhs, rhs) {return rhs[1] - lhs[1];});
          angular.forEach(sortedL, function(keyVal) {
            asStr += (keyVal[1] + ' ' + keyVal[0] + '\n');
          });
        }
        return asStr;
      };

    };

    this.create = function() {
      return new SparseVector();
    };

    this.add = function(lhs, rhs) {
      var rVal = this.create();
      angular.forEach(lhs.vecObj, function(value, key) {
        rVal.set(key, value);
      });
      angular.forEach(rhs.vecObj, function(value, key) {
        rVal.set(key, value);
      });
      return rVal;
    };

    this.scale = function(lhs, scalar) {
      var rVal = this.create();
      angular.forEach(lhs.vecObj, function(value, key) {
        rVal.set(key, value * scalar);
      });
      return rVal;
    }; 

  });

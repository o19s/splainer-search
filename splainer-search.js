angular.module('o19s.splainer-search', []);

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

// Executes a solr search and returns
// a set of queryDocs
angular.module('o19s.splainer-search')
  .service('explainSvc', function explainSvc(vectorSvc) {

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
      var base = new Explain(explJson);
      var description = explJson.description;
      var details = [];
      if (explJson.hasOwnProperty('details')) {
        details = explJson.details;
      }
      var tieMatch = description.match(tieRegex);
      if (description.startsWith('MatchAllDocsQuery')) {
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

    var Explain = function(explJson) {
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
        datExplain.children.push(createExplain(detail));
      });

      this.influencers = function() {
        return [];
      };

      this.contribution = function() {
        return this.realContribution;
      };

      this.explanation = function() {
        return this.realExplanation;
      };

      /* Return my influencers as a vector
       * where magnitude of each dimension is how 
       * much I am influenced
       * */
      this.vectorize = function() {
        var rVal = vectorSvc.create();
        rVal.set(this.explanation(), this.contribution());
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

    var MatchAllDocsExplain = function() {
      this.realExplanation = 'You queried *:* (all docs returned w/ score of 1)';
    };

    var WeightExplain = function(explJson) {
      // take weight(text:foo in 1234), extract text:foo
      var weightRegex = /weight\((.*?)\s+in\s+\d+?\)/;
      var description = explJson.description;
      
      var match = description.match(weightRegex);
      if (match !== null && match.length > 1) {
        this.realExplanation = match[1];
      } else {
        this.realExplanation = description;
      }
    };

    var FunctionQueryExplain = function(explJson) {
      var funcQueryRegex = /FunctionQuery\((.*)\)/;
      var description = explJson.description;
      var match = description.match(funcQueryRegex);
      if (match !== null && match.length > 1) {
        this.realExplanation = match[1];
      } else {
        this.realExplanation = description;
      }
    };

    var CoordExplain = function(explJson, coordFactor) {
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

    var DismaxTieExplain = function(explJson, tie) {
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


    var DismaxExplain = function() {
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

    var SumExplain = function() {
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

    var ProductExplain = function() {
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
        fieldSpec.subs.push(fieldName);
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

    this.createFieldSpec = function(fieldSpecStr) {
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

    var assignSingleField = function(queryDoc, solrDoc, solrField, toProperty) {
      if (solrDoc.hasOwnProperty(solrField)) {
        queryDoc[toProperty] = solrDoc[solrField].slice(0, 200);
      }
    };

    var assignFields = function(queryDoc, solrDoc, fieldSpec) {
      assignSingleField(queryDoc, solrDoc, fieldSpec.id, 'id');
      assignSingleField(queryDoc, solrDoc, fieldSpec.title, 'title');
      assignSingleField(queryDoc, solrDoc, fieldSpec.thumb, 'thumb');
      queryDoc.subs = {};
      angular.forEach(fieldSpec.subs, function(subFieldName) {
        var hl = solrDoc.highlight(queryDoc.id, subFieldName);
        if (hl !== null) {
          queryDoc.subs[subFieldName] = hl;
        }
        else if (solrDoc.hasOwnProperty(subFieldName)) {
          queryDoc.subs[subFieldName] = solrDoc[subFieldName];
        }
      });
    };

    // A document within a query
    var NormalDoc = function(fieldSpec, doc) {
      this.solrDoc = doc;
      assignFields(this, doc, fieldSpec);
      var hasThumb = false;
      if (this.hasOwnProperty('thumb')) {
        hasThumb = true;
      }
      this.subsList = [];
      var that = this;
      angular.forEach(this.subs, function(subValue, subField) {
        if (typeof(subValue) === 'string') {
          subValue = subValue.slice(0,200);
        }
        var expanded = {field: subField, value: subValue};
        that.subsList.push(expanded);
      });

      this.hasThumb = function() {
        return hasThumb;
      };
      
      this.url = function() {
        return this.solrDoc.url(fieldSpec.id, this.id);
      };
    };

    var explainable = function(doc, explainJson) {

      var simplerExplain = explainSvc.createExplain(explainJson);
      var hotMatches = simplerExplain.vectorize();

      doc.explain = function() {
        return simplerExplain;
      };
      
      doc.hotMatches = function() {
        return hotMatches;
      };

      var hotOutOf = [];
      var lastMaxScore = -1;
      doc.hotMatchesOutOf = function(maxScore) {
        if (maxScore !== lastMaxScore) {
          hotOutOf.length = 0;
        }
        lastMaxScore = maxScore;
        if (hotOutOf.length === 0) {
          angular.forEach(hotMatches.vecObj, function(value, key) {
            var percentage = ((0.0 + value) / maxScore) * 100.0;
            hotOutOf.push({description: key, percentage: percentage});
          });
          hotOutOf.sort(function(a,b) {return b.percentage - a.percentage;});
        }
        return hotOutOf;
      };

      doc.score = simplerExplain.contribution();
      return doc;
    };

    this.createNormalDoc = function(fieldSpec, solrDoc) {
      var nDoc = new NormalDoc(fieldSpec, solrDoc);
      return this.explainDoc(nDoc, solrDoc.explain(nDoc.id));
    };

    // Decorate doc with an explain/field values/etc other
    // than what came back from Solr
    this.explainDoc = function(doc, explainJson) {
      var decorated = angular.copy(doc);
      return explainable(decorated, explainJson);
    };

    // A stub, used to display a result that we expected 
    // to find in Solr, but isn't there
    this.createPlaceholderDoc = function(docId, stubTitle) {
      return {id: docId,
              title: stubTitle};
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

// Executes a solr search and returns
// a set of queryDocs
angular.module('o19s.splainer-search')
  .service('solrSearchSvc', function solrSearchSvc($http) {
    // AngularJS will instantiate a singleton by calling 'new' on this function
    
    this.HIGHLIGHTING_PRE = 'aouaoeuCRAZY_STRING!';
    this.HIGHLIGHTING_POST = '62362iueaiCRAZY_POST_STRING!';
    var svc = this;

    var activeQueries = 0;

    var buildUrl = function(url, urlArgs) {
      var baseUrl = url + '?';
      angular.forEach(urlArgs, function(values, param) {
        angular.forEach(values, function(value) {
          baseUrl += param + '=' + value + '&';
        });
      });
      // percentages need to be escaped before
      // url escaping
      baseUrl = baseUrl.replace(/%/g, '%25');
      return baseUrl.slice(0, -1); // take out last & or trailing ? if no args
    };

    var searchSvc = this;
    var buildTokensUrl = function(fieldList, solrUrl, idField, docId) {
      var escId = encodeURIComponent(searchSvc.escapeUserQuery(docId));
      var tokensArgs = {
        'indent': ['true'],
        'wt': ['xml'],
        //'q': [idField + ':' + escId],
        'facet': ['true'],
        'facet.field': [],
        'facet.mincount': ['1'],
      };
      angular.forEach(fieldList, function(fieldName) {
        if (fieldName !== 'score') {
          tokensArgs['facet.field'].push(fieldName);
        }
      });
      return buildUrl(solrUrl, tokensArgs) + '&q=' + idField + ':'  + escId;
    };

    var buildSolrUrl = function(fieldList, solrUrl, solrArgs, queryText) {
      solrArgs.fl = [fieldList.join(' ')];
      solrArgs.wt = ['json'];
      solrArgs.debug = ['true'];
      solrArgs['debug.explain.structured'] = ['true'];
      solrArgs.hl = ['true'];
      solrArgs['hl.simple.pre'] = [svc.HIGHLIGHTING_PRE];
      solrArgs['hl.simple.post'] = [svc.HIGHLIGHTING_POST];
      var baseUrl = buildUrl(solrUrl, solrArgs);
      baseUrl = baseUrl.replace(/#\$query##/g, encodeURIComponent(queryText));
      return baseUrl;
    };

    var SolrSearcher = function(fieldList, solrUrl, solrArgs, queryText) {
      this.callUrl = this.linkUrl = '';
      this.callUrl = buildSolrUrl(fieldList, solrUrl, solrArgs, queryText);
      this.linkUrl = this.callUrl.replace('wt=json', 'wt=xml');
      this.linkUrl = this.linkUrl + '&indent=true&echoParams=all';
      this.docs = [];
      this.numFound = 0;
      this.inError = false;


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
          that.numFound = data.response.numFound;
          var explDict = getExplData(data);
          var hlDict = getHlData(data);
          angular.forEach(data.response.docs, function(solrDoc) {
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
            solrDoc.highlight = function(docId, fieldName) {
              if (hlDict.hasOwnProperty(docId)) {
                var docHls = hlDict[docId];
                if (docHls.hasOwnProperty(fieldName)) {
                  return docHls[fieldName];
                }
              }
              return null;
            };
            that.docs.push(solrDoc);
          });
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

    this.createSearcher = function (fieldList, solrUrl, solrArgs, queryText) {
      return new SolrSearcher(fieldList, solrUrl, solrArgs, queryText);
    };

    this.activeQueries = function() {
      return activeQueries;
    };
    
    this.escapeUserQuery = function(queryText) {
      var escapeChars = ['+', '-', '&', '!', '(', ')', '[', ']',
                         '{', '}', '^', '"', '~', '*', '?', ':', '\\'];
      var regexp = new RegExp('(\\' + escapeChars.join('|\\') + ')', 'g');
      return queryText.replace(regexp, '\\$1');
    };

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

    /* Parse a Solr URL of the form [/]solr/[collectionName]/[requestHandler]
     * return object with {collectionName: <collectionName>, requestHandler: <requestHandler>} 
     * return null on failure to parse as above solr url
     * */
    this.parseSolrPath = function(pathStr) {
      if (pathStr.startsWith('/')) {
        pathStr = pathStr.slice(1);
      }
      var solrPrefix = 'solr/';
      if (pathStr.startsWith(solrPrefix)) {
        pathStr = pathStr.slice(solrPrefix.length);
        var colAndHandler = pathStr.split('/');
        if (colAndHandler.length === 2) {
          var collectionName = colAndHandler[0];
          var requestHandler = colAndHandler[1];
          if (requestHandler.endsWith('/')) {
            requestHandler = requestHandler.slice(0, requestHandler.length - 1);
          }
          return {'collectionName': collectionName,
                  'requestHandler': requestHandler};
        }
      }
      return null;
    };

    /* Parse a Sor URL of the form [http|https]://[host]/solr/[collectionName]/[requestHandler]?[args]
     * return null on failure to parse
     * */
    this.parseSolrUrl = function(solrReq) {

      var parseUrl = function(url) {
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

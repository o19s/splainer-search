'use strict';

/*
 * Migration Safety Tests
 * ========================
 * These tests pin down behaviors that are at risk during the Angular→vanilla JS migration.
 * They focus on:
 * 1. Deep-copy semantics (angular.copy → structuredClone/Object.assign)
 * 2. Null-safety of iteration (angular.forEach → native loops)
 * 3. fieldSpecSvc full API contract (used by every consumer)
 * 4. Doc factory isolation (angular.copy in base constructor)
 * 5. Preprocessor output contracts (what searchers expect from preprocessors)
 * 6. angular.merge edge cases (null leaves, array merge-by-index vs whole-array replace)
 * 7. $http response shape (.data, .status, .headers()) for fetch wrappers
 * 8. BulkTransportFactory setTimeout-driven batching
 * 9. Registered injectables as the public API surface for DI / ES-module export parity
 *
 * ResolverFactory with chunkSize <= 0 is covered in test/spec/docResolverSvc.js (sliceIds undefined).
 */

describe('Migration Safety: deep-copy semantics', function () {

  beforeEach(module('o19s.splainer-search'));

  // =========================================================================
  // DocFactory: angular.copy(doc, self) in constructor
  // Risk: replacing with Object.assign gives shallow copy; nested mutation leaks
  // =========================================================================
  describe('DocFactory base constructor isolation', function() {
    var DocFactory;

    beforeEach(inject(function (_DocFactory_) {
      DocFactory = _DocFactory_;
    }));

    it('deeply copies nested objects so mutations do not leak back', function() {
      var rawDoc = {
        id: '1',
        nested: { a: 1, b: { c: 2 } },
        arr: [1, 2, 3]
      };
      var doc = new DocFactory(rawDoc, {});

      // Mutate the doc instance's nested property
      doc.nested.b.c = 999;
      doc.arr.push(4);

      // Original should be unaffected
      expect(rawDoc.nested.b.c).toEqual(2);
      expect(rawDoc.arr.length).toEqual(3);
    });

    it('preserves the original doc reference in .doc property', function() {
      var rawDoc = { id: '1', title: 'test' };
      var doc = new DocFactory(rawDoc, {});

      expect(doc.doc).toBe(rawDoc);
    });
  });

  // =========================================================================
  // EsDocFactory: inherits DocFactory, adds field flattening
  // =========================================================================
  describe('EsDocFactory deep-copy isolation', function() {
    var EsDocFactory;

    beforeEach(inject(function (_EsDocFactory_) {
      EsDocFactory = _EsDocFactory_;
    }));

    it('origin() returns a new object each call — top-level mutations do not leak', function() {
      var rawDoc = {
        _id: '1',
        _source: {
          title: 'Original',
          description: 'Unchanged'
        }
      };
      var doc = new EsDocFactory(rawDoc, {});
      var orig1 = doc.origin();

      orig1.title = 'Modified';

      var orig2 = doc.origin();
      expect(orig2.title).toEqual('Original');
      // origin() is NOT a reference to the same object
      expect(orig1).not.toBe(orig2);
    });

    it('origin() is a DEEP copy — nested mutations do NOT leak', function() {
      var rawDoc = {
        _id: '1',
        _source: {
          metadata: { nested: 'value' }
        }
      };
      var doc = new EsDocFactory(rawDoc, {});
      var orig1 = doc.origin();

      orig1.metadata.nested = 'changed';

      var orig2 = doc.origin();
      // origin() now deep-copies, so mutations to orig1 do not affect orig2
      expect(orig2.metadata.nested).toEqual('value');
    });

    it('flattens single-element arrays from _source', function() {
      var rawDoc = {
        _id: '1',
        _source: {
          title: ['Only'],
          multi: ['a', 'b'],
          scalar: 'plain'
        }
      };
      var doc = new EsDocFactory(rawDoc, {});

      expect(doc.title).toEqual('Only');
      expect(doc.multi).toEqual(['a', 'b']);
      expect(doc.scalar).toEqual('plain');
    });
  });

  // =========================================================================
  // SolrDocFactory: origin() uses angular.copy
  // =========================================================================
  describe('SolrDocFactory deep-copy isolation', function() {
    var SolrDocFactory;

    beforeEach(inject(function (_SolrDocFactory_) {
      SolrDocFactory = _SolrDocFactory_;
    }));

    it('origin() returns a deep copy — mutations do not affect subsequent calls', function() {
      var rawDoc = {
        id: '1',
        title: 'Test',
        nested: { key: 'original' }
      };
      var doc = new SolrDocFactory(rawDoc, {
        url: 'http://localhost:8983/solr/select',
        explDict: {},
        hlDict: {},
        highlightingPre: 'em',
        highlightingPost: '/em'
      });

      var orig1 = doc.origin();
      orig1.nested.key = 'mutated';

      var orig2 = doc.origin();
      expect(orig2.nested.key).toEqual('original');
    });
  });
});

describe('Migration Safety: angular.forEach null-safety', function() {

  beforeEach(module('o19s.splainer-search'));

  // =========================================================================
  // fieldSpecSvc.forEachField: iterates optional arrays (embeds, translations, etc.)
  // Risk: if these are undefined and we switch to native forEach, it throws
  // =========================================================================
  describe('fieldSpecSvc.forEachField with missing optional fields', function() {
    var fieldSpecSvc;

    beforeEach(inject(function (_fieldSpecSvc_) {
      fieldSpecSvc = _fieldSpecSvc_;
    }));

    it('forEachField works when no embeds/translations/highlights/functions exist', function() {
      // Minimal spec: only id and title
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId myTitle');
      var fields = [];

      // This must not throw even though embeds, translations, functions etc. are undefined
      fieldSpec.forEachField(function(f) { fields.push(f); });

      expect(fields).toContain('myTitle');
    });

    it('forEachField works with wildcard subs', function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId myTitle *');
      var fields = [];

      // subs='*' is a string, not an array — angular.forEach on a string iterates chars
      // This documents the current behavior for migration
      fieldSpec.forEachField(function(f) { fields.push(f); });

      expect(fields).toContain('myTitle');
    });

    it('highlightFieldList returns undefined when no highlights specified', function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId myTitle sub1');

      // This is passed directly to prepareHighlighting in ES preprocessor
      // which checks angular.isDefined — need to preserve this undefined behavior
      expect(fieldSpec.highlightFieldList()).toBeUndefined();
    });
  });

  // =========================================================================
  // normalDocsSvc: several angular.forEach calls on fieldSpec arrays
  // =========================================================================
  describe('normalDocsSvc with empty/missing fieldSpec arrays', function() {
    var normalDocsSvc, fieldSpecSvc;

    beforeEach(inject(function (_normalDocsSvc_, _fieldSpecSvc_) {
      normalDocsSvc = _normalDocsSvc_;
      fieldSpecSvc = _fieldSpecSvc_;
    }));

    var mockDoc = function(origin) {
      return {
        origin: function() { return origin; },
        explain: function() { return null; },
        highlight: function() { return null; },
        _url: function() { return 'http://example.com'; }
      };
    };

    it('handles doc with no embeds/translations/unabridgeds in fieldSpec', function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:myTitle');
      var origin = { myId: '1', myTitle: 'Test' };

      // Must not throw when embeds/translations/unabridgeds are undefined
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, mockDoc(origin));

      expect(normalDoc.id).toEqual('1');
      expect(normalDoc.embeds).toEqual({});
      expect(normalDoc.translations).toEqual({});
      expect(normalDoc.unabridgeds).toEqual({});
    });

    it('handles doc where origin has empty/null field values', function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:myTitle sub:desc');
      var origin = { myId: '1', myTitle: null, desc: undefined };

      // null and undefined fields should produce empty strings, not "null"/"undefined"
      var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, mockDoc(origin));

      expect(normalDoc.id).toEqual('1');
      expect(normalDoc.title).toEqual('');
    });
  });
});

describe('Migration Safety: preprocessor output contracts', function() {

  beforeEach(module('o19s.splainer-search'));

  // =========================================================================
  // ES preprocessor: uses angular.copy, angular.merge, angular.isDefined
  // Pin down the exact shape of output so migration preserves it
  // =========================================================================
  describe('esSearcherPreprocessorSvc contract', function() {
    var esSearcherPreprocessorSvc;

    beforeEach(inject(function (_esSearcherPreprocessorSvc_) {
      esSearcherPreprocessorSvc = _esSearcherPreprocessorSvc_;
    }));

    it('prepare sets queryDsl with explain and profile for POST', function() {
      var searcher = {
        args: {
          query: { match: { title: '#$query##' } }
        },
        queryText: 'test query',
        config: { apiMethod: 'POST', numberOfRows: 10 },
        fieldList: ['title', 'id'],
        url: 'http://localhost:9200/index/_search'
      };

      esSearcherPreprocessorSvc.prepare(searcher);

      expect(searcher.queryDsl).toBeDefined();
      expect(searcher.queryDsl.explain).toBe(true);
      expect(searcher.queryDsl.profile).toBe(true);
      expect(searcher.pagerArgs).toBeDefined();
      expect(searcher.pagerArgs.from).toEqual(0);
      expect(searcher.pagerArgs.size).toEqual(10);
    });

    it('prepare does not mutate the original args.pager', function() {
      var originalPager = { from: 5, size: 20 };
      var pagerCopy = { from: 5, size: 20 };
      var searcher = {
        args: {
          query: { match_all: {} },
          pager: originalPager
        },
        queryText: 'test',
        config: { apiMethod: 'POST', numberOfRows: 10 },
        fieldList: ['title'],
        url: 'http://localhost:9200/idx/_search'
      };

      esSearcherPreprocessorSvc.prepare(searcher);

      // The original pager object should not have been mutated
      // (angular.copy creates a deep clone before merge)
      expect(originalPager.from).toEqual(pagerCopy.from);
      expect(originalPager.size).toEqual(pagerCopy.size);
    });

    it('prepare appends highlight when not already in queryDsl', function() {
      var searcher = {
        args: {
          query: { match_all: {} }
        },
        queryText: 'test',
        config: { apiMethod: 'POST', numberOfRows: 10 },
        fieldList: ['title', 'body'],
        url: 'http://localhost:9200/idx/_search'
      };

      esSearcherPreprocessorSvc.prepare(searcher);

      expect(searcher.queryDsl.highlight).toBeDefined();
      expect(searcher.queryDsl.highlight.fields).toBeDefined();
    });

    it('prepare does not override existing highlight in queryDsl', function() {
      var customHighlight = { fields: { custom_field: {} } };
      var searcher = {
        args: {
          query: { match_all: {} },
          highlight: customHighlight
        },
        queryText: 'test',
        config: { apiMethod: 'POST', numberOfRows: 10 },
        fieldList: ['title'],
        url: 'http://localhost:9200/idx/_search'
      };

      esSearcherPreprocessorSvc.prepare(searcher);

      expect(searcher.queryDsl.highlight.fields.custom_field).toBeDefined();
    });

    it('prepare for GET appends query text and size to URL', function() {
      var searcher = {
        args: {},
        queryText: 'hello world',
        config: { apiMethod: 'GET', numberOfRows: 25 },
        url: 'http://localhost:9200/idx/_search'
      };

      esSearcherPreprocessorSvc.prepare(searcher);

      expect(searcher.url).toContain('q=hello%20world');
      expect(searcher.url).toContain('size=25');
    });
  });

  // =========================================================================
  // Solr preprocessor: uses angular.copy, angular.merge
  // =========================================================================
  describe('solrSearcherPreprocessorSvc contract', function() {
    var solrSearcherPreprocessorSvc;

    beforeEach(inject(function (_solrSearcherPreprocessorSvc_) {
      solrSearcherPreprocessorSvc = _solrSearcherPreprocessorSvc_;
    }));

    it('prepare builds callUrl from url and args', function() {
      var searcher = {
        args: { q: ['#$query##'], fq: ['type:book'] },
        queryText: 'test',
        url: 'http://localhost:8983/solr/select',
        config: {
          escapeQuery: false,
          numberOfRows: 10,
          sanitize: true,
          highlight: true
        },
        fieldList: ['id', 'title'],
        hlFieldList: ['title'],
        HIGHLIGHTING_PRE: 'PRE',
        HIGHLIGHTING_POST: 'POST'
      };

      solrSearcherPreprocessorSvc.prepare(searcher);

      expect(searcher.callUrl).toBeDefined();
      expect(searcher.callUrl).toContain('http://localhost:8983/solr/select');
    });

    it('prepare does not mutate the original args', function() {
      var originalArgs = { q: ['#$query##'] };
      var searcher = {
        args: originalArgs,
        queryText: 'test',
        url: 'http://localhost:8983/solr/select',
        config: { escapeQuery: false, numberOfRows: 10 },
        fieldList: ['id'],
        HIGHLIGHTING_PRE: 'PRE',
        HIGHLIGHTING_POST: 'POST'
      };

      solrSearcherPreprocessorSvc.prepare(searcher);

      // Original args q should still have the template
      expect(originalArgs.q[0]).toEqual('#$query##');
    });
  });

  // =========================================================================
  // Vectara preprocessor: uses angular.copy, angular.merge
  // =========================================================================
  describe('vectaraSearcherPreprocessorSvc contract', function() {
    var vectaraSearcherPreprocessorSvc;

    beforeEach(inject(function (_vectaraSearcherPreprocessorSvc_) {
      vectaraSearcherPreprocessorSvc = _vectaraSearcherPreprocessorSvc_;
    }));

    it('prepare sets queryDsl and pagerArgs', function() {
      var searcher = {
        args: {
          query: [{ query: '#$query##', numResults: 10 }]
        },
        queryText: 'test query',
        config: { numberOfRows: 10 },
        url: 'http://api.vectara.io/v1/query'
      };

      vectaraSearcherPreprocessorSvc.prepare(searcher);

      expect(searcher.queryDsl).toBeDefined();
      expect(searcher.pagerArgs).toBeDefined();
    });
  });
});

describe('Migration Safety: searchSvc engine routing', function() {

  beforeEach(module('o19s.splainer-search'));

  var searchSvc, fieldSpecSvc;

  beforeEach(inject(function (_searchSvc_, _fieldSpecSvc_) {
    searchSvc = _searchSvc_;
    fieldSpecSvc = _fieldSpecSvc_;
  }));

  // Pin down which factory is used for each engine type
  // This is critical: the DI wiring disappears during migration

  var engines = ['solr', 'es', 'os', 'vectara', 'algolia', 'searchapi'];

  engines.forEach(function(engine) {
    it('creates a searcher for engine: ' + engine, function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId title:myTitle');
      var args = engine === 'es' || engine === 'os'
        ? { query: { match_all: {} } }
        : { q: ['#$query##'] };

      var searcher = searchSvc.createSearcher(
        fieldSpec,
        'http://localhost/search',
        args,
        'test query',
        {},
        engine
      );

      expect(searcher).toBeDefined();
      expect(searcher.type).toEqual(engine);
    });
  });

  it('returns undefined for unknown engine type', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId');
    var searcher = searchSvc.createSearcher(
      fieldSpec,
      'http://localhost/search',
      {},
      'test',
      {},
      'unknown_engine'
    );

    expect(searcher).toBeUndefined();
  });
});

describe('Migration Safety: vectorSvc pure functions', function() {

  beforeEach(module('o19s.splainer-search'));

  var vectorSvc;

  beforeEach(inject(function (_vectorSvc_) {
    vectorSvc = _vectorSvc_;
  }));

  // vectorSvc uses angular.forEach heavily — pin down exact behavior

  it('add merges two vectors (last-write-wins on key collision)', function() {
    var a = vectorSvc.create();
    a.set('x', 1);
    a.set('y', 2);

    var b = vectorSvc.create();
    b.set('y', 10);
    b.set('z', 3);

    var result = vectorSvc.add(a, b);

    expect(result.get('x')).toEqual(1);
    expect(result.get('y')).toEqual(10); // b overwrites a
    expect(result.get('z')).toEqual(3);
  });

  it('sumOf accumulates values on key collision', function() {
    var a = vectorSvc.create();
    a.set('x', 1);
    a.set('y', 2);

    var b = vectorSvc.create();
    b.set('y', 10);
    b.set('z', 3);

    var result = vectorSvc.sumOf(a, b);

    expect(result.get('x')).toEqual(1);
    expect(result.get('y')).toEqual(12); // 2 + 10
    expect(result.get('z')).toEqual(3);
  });

  it('scale multiplies all values by scalar', function() {
    var v = vectorSvc.create();
    v.set('a', 2);
    v.set('b', 5);

    var result = vectorSvc.scale(v, 3);

    expect(result.get('a')).toEqual(6);
    expect(result.get('b')).toEqual(15);
  });

  it('does not mutate input vectors', function() {
    var a = vectorSvc.create();
    a.set('x', 1);

    var b = vectorSvc.create();
    b.set('x', 2);

    vectorSvc.add(a, b);
    vectorSvc.sumOf(a, b);
    vectorSvc.scale(a, 10);

    expect(a.get('x')).toEqual(1);
    expect(b.get('x')).toEqual(2);
  });

  it('toStr sorts by value descending', function() {
    var v = vectorSvc.create();
    v.set('low', 1);
    v.set('high', 10);
    v.set('mid', 5);

    var str = v.toStr();
    var highIdx = str.indexOf('high');
    var midIdx = str.indexOf('mid');
    var lowIdx = str.indexOf('low');

    expect(highIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(lowIdx);
  });

  it('get ignores inherited properties on vecObj (own keys only)', function() {
    var v = vectorSvc.create();
    Object.setPrototypeOf(v.vecObj, { inherited: 42 });
    expect(v.get('inherited')).toBeUndefined();
  });

  it('toStr recomputes after mutation once cached', function() {
    var v = vectorSvc.create();
    v.set('a', 1);
    var first = v.toStr();
    v.set('b', 2);
    var second = v.toStr();
    expect(second).toContain('b');
    expect(second).not.toEqual(first);
  });

  it('toStr uses newline-terminated lines', function() {
    var v = vectorSvc.create();
    v.set('k', 1);
    v.set('j', 2);
    var lines = v.toStr().split('\n').filter(function(line) { return line.length > 0; });
    expect(lines.length).toEqual(2);
    expect(v.toStr().slice(-1)).toBe('\n');
  });
});

describe('Migration Safety: transport routing', function() {

  beforeEach(module('o19s.splainer-search'));

  var transportSvc;

  beforeEach(inject(function (_transportSvc_) {
    transportSvc = _transportSvc_;
  }));

  it('routes POST (default) correctly', function() {
    var transport = transportSvc.getTransport({});
    expect(transport).toBeDefined();
    expect(transport.query).toBeDefined();
  });

  it('routes GET correctly', function() {
    var transport = transportSvc.getTransport({ apiMethod: 'GET' });
    expect(transport).toBeDefined();
  });

  it('routes JSONP correctly', function() {
    var transport = transportSvc.getTransport({ apiMethod: 'JSONP' });
    expect(transport).toBeDefined();
  });

  it('routes BULK correctly', function() {
    var transport = transportSvc.getTransport({ apiMethod: 'BULK' });
    expect(transport).toBeDefined();
  });

  it('is case-insensitive on apiMethod', function() {
    var transport = transportSvc.getTransport({ apiMethod: 'get' });
    expect(transport).toBeDefined();
  });

  it('wraps in proxy when proxyUrl is set', function() {
    var transport = transportSvc.getTransport({
      apiMethod: 'POST',
      proxyUrl: 'http://proxy.example.com'
    });
    expect(transport).toBeDefined();
    expect(transport.query).toBeDefined();
  });
});

// =========================================================================
// angular.merge deep-merge semantics
// Risk: angular.merge does RECURSIVE deep merge; Object.assign is SHALLOW
// These tests pin the behavior used by preprocessors
// =========================================================================
describe('Migration Safety: angular.merge deep-merge semantics', function() {

  beforeEach(module('o19s.splainer-search'));

  describe('esSearcherPreprocessorSvc merges nested config deeply', function() {
    var esSearcherPreprocessorSvc;

    beforeEach(inject(function (_esSearcherPreprocessorSvc_) {
      esSearcherPreprocessorSvc = _esSearcherPreprocessorSvc_;
    }));

    it('deep-merges nested config properties (not shallow overwrite)', function() {
      var searcher = {
        args: { query: { match_all: {} } },
        queryText: 'test',
        config: {
          apiMethod: 'POST',
          numberOfRows: 5,
          // Override only numberOfRows; other defaults should survive
        },
        fieldList: ['title'],
        url: 'http://localhost:9200/idx/_search'
      };

      esSearcherPreprocessorSvc.prepare(searcher);

      // Default config has debug:true, highlight:true — these should survive merge
      expect(searcher.config.numberOfRows).toEqual(5);
      // After merge with defaultESConfig, the config should have defaults filled in
      expect(searcher.config).toBeDefined();
    });

    it('user config overrides default config values', function() {
      var searcher = {
        args: { query: { match_all: {} } },
        queryText: 'test',
        config: {
          apiMethod: 'POST',
          numberOfRows: 25,
          highlight: false,
          debug: false
        },
        fieldList: ['title'],
        url: 'http://localhost:9200/idx/_search'
      };

      esSearcherPreprocessorSvc.prepare(searcher);

      expect(searcher.config.numberOfRows).toEqual(25);
      expect(searcher.config.highlight).toBe(false);
      expect(searcher.config.debug).toBe(false);
    });
  });

  describe('solrSearcherPreprocessorSvc merges config deeply', function() {
    var solrSearcherPreprocessorSvc;

    beforeEach(inject(function (_solrSearcherPreprocessorSvc_) {
      solrSearcherPreprocessorSvc = _solrSearcherPreprocessorSvc_;
    }));

    it('preserves default config values not overridden by user', function() {
      var searcher = {
        args: { q: ['#$query##'] },
        queryText: 'test',
        url: 'http://localhost:8983/solr/select',
        config: { numberOfRows: 20 },
        fieldList: ['id'],
        HIGHLIGHTING_PRE: 'PRE',
        HIGHLIGHTING_POST: 'POST'
      };

      solrSearcherPreprocessorSvc.prepare(searcher);

      // Config should have been merged with defaultSolrConfig
      expect(searcher.config).toBeDefined();
      expect(searcher.config.numberOfRows).toEqual(20);
    });
  });

  describe('vectaraSearcherPreprocessorSvc merges config deeply', function() {
    var vectaraSearcherPreprocessorSvc;

    beforeEach(inject(function (_vectaraSearcherPreprocessorSvc_) {
      vectaraSearcherPreprocessorSvc = _vectaraSearcherPreprocessorSvc_;
    }));

    it('fills in default config when user provides partial config', function() {
      var searcher = {
        args: { query: [{ query: '#$query##', numResults: 10 }] },
        queryText: 'test',
        config: {},
        url: 'http://api.vectara.io/v1/query'
      };

      vectaraSearcherPreprocessorSvc.prepare(searcher);

      // After merge with defaultVectaraConfig, apiMethod should be set
      expect(searcher.config.apiMethod).toBe('POST');
    });
  });
});

// =========================================================================
// angular.copy deep-clone in DocFactory base constructor
// Risk: Object.assign is shallow; nested objects would be shared references
// =========================================================================
describe('Migration Safety: DocFactory deep clone with nested arrays and objects', function() {

  beforeEach(module('o19s.splainer-search'));

  var DocFactory;

  beforeEach(inject(function (_DocFactory_) {
    DocFactory = _DocFactory_;
  }));

  it('deeply clones arrays inside doc so mutations do not leak', function() {
    var rawDoc = { id: '1', tags: ['a', 'b'], nested: { list: [1, 2, 3] } };
    var doc = new DocFactory(rawDoc, {});

    doc.tags.push('c');
    doc.nested.list.push(4);

    expect(rawDoc.tags).toEqual(['a', 'b']);
    expect(rawDoc.nested.list).toEqual([1, 2, 3]);
  });

  it('deeply clones multiple levels of nesting', function() {
    var rawDoc = { id: '1', level1: { level2: { level3: { val: 'original' } } } };
    var doc = new DocFactory(rawDoc, {});

    doc.level1.level2.level3.val = 'mutated';

    expect(rawDoc.level1.level2.level3.val).toEqual('original');
  });
});

// =========================================================================
// angular.isFunction filtering in doc factory origin()
// Risk: typeof x === 'function' works differently from angular.isFunction
//       in edge cases (e.g., null, regex). Pin the filtering behavior.
// =========================================================================
describe('Migration Safety: doc factory origin() excludes functions', function() {

  beforeEach(module('o19s.splainer-search'));

  describe('AlgoliaDocFactory origin excludes methods', function() {
    var AlgoliaDocFactory;

    beforeEach(inject(function (_AlgoliaDocFactory_) {
      AlgoliaDocFactory = _AlgoliaDocFactory_;
    }));

    it('origin() does not include function-valued properties', function() {
      var rawDoc = { objectID: '1', title: 'Test', score: 1.5 };
      var doc = new AlgoliaDocFactory(rawDoc, { fieldList: ['title'] });
      var orig = doc.origin();

      // origin should have data fields but not methods
      Object.keys(orig).forEach(function(key) {
        expect(typeof orig[key]).not.toBe('function');
      });
      expect(orig.title).toBe('Test');
    });
  });

  describe('VectaraDocFactory origin excludes methods', function() {
    var VectaraDocFactory;

    beforeEach(inject(function (_VectaraDocFactory_) {
      VectaraDocFactory = _VectaraDocFactory_;
    }));

    it('origin() does not include function-valued properties', function() {
      var rawDoc = {
        id: '1',
        metadata: [
          { name: 'title', value: 'Test' },
          { name: 'score', value: '1.5' }
        ]
      };
      var doc = new VectaraDocFactory(rawDoc, { fieldList: ['title'] });
      var orig = doc.origin();

      Object.keys(orig).forEach(function(key) {
        expect(typeof orig[key]).not.toBe('function');
      });
    });
  });

  describe('SearchApiDocFactory origin excludes methods', function() {
    var SearchApiDocFactory;

    beforeEach(inject(function (_SearchApiDocFactory_) {
      SearchApiDocFactory = _SearchApiDocFactory_;
    }));

    it('origin() does not include function-valued properties', function() {
      var rawDoc = { id: '1', title: 'Test', score: 1.5 };
      var doc = new SearchApiDocFactory(rawDoc, { fieldList: ['title'] });
      var orig = doc.origin();

      Object.keys(orig).forEach(function(key) {
        expect(typeof orig[key]).not.toBe('function');
      });
      expect(orig.title).toBe('Test');
    });
  });
});

// =========================================================================
// angular.forEach null/undefined safety in critical code paths
// Risk: native for...of or .forEach() throws on null/undefined
// Pin that these code paths handle null/undefined gracefully
// =========================================================================
describe('Migration Safety: angular.forEach null safety in source code', function() {

  beforeEach(module('o19s.splainer-search'));

  describe('baseExplainSvc handles null/empty details', function() {
    var baseExplainSvc;

    beforeEach(inject(function(_baseExplainSvc_) {
      baseExplainSvc = _baseExplainSvc_;
    }));

    it('handles explain with null details', function() {
      var explain = new baseExplainSvc.Explain({
        value: 1.0,
        description: 'test',
        details: null
      });
      expect(explain.children.length).toBe(0);
    });

    it('handles explain with undefined details', function() {
      var explain = new baseExplainSvc.Explain({
        value: 1.0,
        description: 'test'
      });
      expect(explain.children.length).toBe(0);
    });

    it('handles explain with empty array details', function() {
      var explain = new baseExplainSvc.Explain({
        value: 1.0,
        description: 'test',
        details: []
      });
      expect(explain.children.length).toBe(0);
    });

    it('crashes on null entries in details array (migration note: add null guard)', function() {
      // baseExplainSvc.Explain requires an explFactory for children
      var explFactory = function(detail) {
        return new baseExplainSvc.Explain(detail, explFactory);
      };
      // angular.forEach does NOT skip null array elements (only null collections).
      // So explFactory(null) tries to read null.value and throws.
      // This documents the current behavior — the vanilla JS migration should add a null guard.
      expect(function() {
        new baseExplainSvc.Explain({
          value: 1.0,
          description: 'test',
          details: [
            { value: 0.5, description: 'child1' },
            null,
            { value: 0.3, description: 'child3' }
          ]
        }, explFactory);
      }).toThrow();
    });
  });

  describe('solrUrlSvc.formatSolrArgs handles edge cases', function() {
    var solrUrlSvc;

    beforeEach(inject(function(_solrUrlSvc_) {
      solrUrlSvc = _solrUrlSvc_;
    }));

    it('handles empty args object', function() {
      var result = solrUrlSvc.formatSolrArgs({});
      expect(result).toBe('');
    });

    it('handles args with string values (not arrays)', function() {
      // angular.forEach on a string iterates chars — pin this behavior
      var result = solrUrlSvc.formatSolrArgs({ q: '*:*' });
      // String value should be handled (each char gets its own param)
      expect(result).toBeDefined();
    });
  });

  describe('fieldSpecSvc.createFieldSpec handles edge inputs', function() {
    var fieldSpecSvc;

    beforeEach(inject(function(_fieldSpecSvc_) {
      fieldSpecSvc = _fieldSpecSvc_;
    }));

    it('handles empty string', function() {
      var spec = fieldSpecSvc.createFieldSpec('');
      expect(spec.id).toBeDefined();
    });

    it('handles null input', function() {
      var spec = fieldSpecSvc.createFieldSpec(null);
      expect(spec).toBeDefined();
      expect(spec.id).toBeDefined();
    });
  });
});

// =============================================================================
// A (supplement). angular.forEach on possibly undefined collections
// =============================================================================
describe('Migration Safety: angular.forEach on undefined collections (source paths)', function() {

  beforeEach(module('o19s.splainer-search'));

  it('angular.forEach(undefined/null) is a no-op (native forEach would throw)', function() {
    var n = 0;
    angular.forEach(undefined, function() { n++; });
    angular.forEach(null, function() { n++; });
    expect(n).toBe(0);
  });

  describe('SolrSearcherFactory.search with malformed response.docs', function() {
    var searchSvc;
    var fieldSpecSvc;
    var $httpBackend;

    beforeEach(inject(function(_searchSvc_, _fieldSpecSvc_, $injector) {
      searchSvc = _searchSvc_;
      fieldSpecSvc = _fieldSpecSvc_;
      $httpBackend = $injector.get('$httpBackend');
    }));

    it('does not throw when response exists but docs is missing (angular.forEach(undefined) no-op)', function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id field');
      var searcher = searchSvc.createSearcher(
        fieldSpec,
        'http://localhost:8983/solr/select',
        { q: ['#$query##'] },
        'test',
        { apiMethod: 'GET' },
        'solr'
      );
      var body = { response: { numFound: 0 } };
      $httpBackend.expectGET(/.*/).respond(200, body);
      var settled = false;
      searcher.search().then(function() {
        settled = true;
        expect(searcher.docs.length).toBe(0);
      });
      $httpBackend.flush();
      expect(settled).toBe(true);
    });
  });

  describe('normalDocsSvc fieldSpec.functions and highlights (forEach paths)', function() {
    var normalDocsSvc;
    var fieldSpecSvc;

    beforeEach(inject(function(_normalDocsSvc_, _fieldSpecSvc_) {
      normalDocsSvc = _normalDocsSvc_;
      fieldSpecSvc = _fieldSpecSvc_;
    }));

    var mockDoc = function(origin) {
      return {
        origin: function() { return origin; },
        explain: function() { return null; },
        highlight: function() { return null; },
        _url: function() { return 'http://example.com'; }
      };
    };

    it('handles fieldSpec with function and highlight fields without throwing', function() {
      var fieldSpec = fieldSpecSvc.createFieldSpec('id:myId, myTitle, func:foo, hl:bar');
      var origin = { myId: '1', myTitle: 'T', foo: 'fv', bar: 'hlval' };
      var doc = normalDocsSvc.createNormalDoc(fieldSpec, mockDoc(origin));
      expect(doc.subs.foo).toEqual('fv');
      expect(doc.subs.bar).toEqual('hlval');
    });
  });

  describe('BulkTransportFactory queue forEach (replaces legacy requestBatches map)', function() {
    var BulkTransportFactory;
    var $httpBackend;

    beforeEach(function() { jasmine.clock().install(); });
    afterEach(function() { jasmine.clock().uninstall(); });

    beforeEach(inject(function(_BulkTransportFactory_, $injector) {
      BulkTransportFactory = _BulkTransportFactory_;
      $httpBackend = $injector.get('$httpBackend');
    }));

    it('multiSearchFailed still runs angular.forEach(queue, ...) when queue is non-empty', async function() {
      var bulk = new BulkTransportFactory();
      var url = 'http://es.example.com/i/_msearch';
      var p = bulk.query(url, { query: 1 }, {});
      var rejected = false;
      p.catch(function() { rejected = true; });
      $httpBackend.expectPOST(url).respond(500, { error: 'fail' });
      jasmine.clock().tick(100);
      $httpBackend.flush();
      await Promise.resolve().then(function () { return Promise.resolve(); });
      expect(rejected).toBe(true);
    });
  });
});

// =============================================================================
// B. angular.copy vs JSON.stringify / shallow clone (migration hazards)
// =============================================================================
describe('Migration Safety: angular.copy edge cases', function() {

  it('preserves Date instances (JSON.parse(JSON.stringify) would stringify)', function() {
    var d = new Date(Date.UTC(2020, 0, 2));
    var src = { at: d };
    var c = angular.copy(src);
    expect(c.at instanceof Date).toBe(true);
    expect(c.at.getTime()).toEqual(d.getTime());
  });

  it('preserves own properties whose value is undefined (JSON.stringify drops them)', function() {
    var src = { a: 1, b: undefined };
    var c = angular.copy(src);
    expect(Object.hasOwn(c, 'b')).toBe(true);
    expect(c.b).toBeUndefined();
  });

  it('copies objects with circular references', function() {
    var src = { a: 1 };
    src.self = src;
    var c = angular.copy(src);
    expect(c).not.toBe(src);
    expect(c.self).toBe(c);
  });
});

describe('Migration Safety: preprocessor angular.copy output shape', function() {

  beforeEach(module('o19s.splainer-search'));

  describe('esSearcherPreprocessorSvc', function() {
    var esSearcherPreprocessorSvc;

    beforeEach(inject(function(_esSearcherPreprocessorSvc_) {
      esSearcherPreprocessorSvc = _esSearcherPreprocessorSvc_;
    }));

    it('leaves searcher.args.query independent of queryDsl.query after prepare', function() {
      var inner = { match_all: {} };
      var searcher = {
        args: { query: inner },
        queryText: 'x',
        config: { apiMethod: 'POST', numberOfRows: 5 },
        fieldList: ['title'],
        url: 'http://localhost:9200/idx/_search'
      };
      esSearcherPreprocessorSvc.prepare(searcher);
      inner.match_all.boost = 42;
      expect(searcher.queryDsl).toBeDefined();
      expect(searcher.queryDsl.query).toBeDefined();
      expect(searcher.queryDsl.query.match_all.boost).toBeUndefined();
    });
  });

  describe('solrSearcherPreprocessorSvc', function() {
    var solrSearcherPreprocessorSvc;

    beforeEach(inject(function(_solrSearcherPreprocessorSvc_) {
      solrSearcherPreprocessorSvc = _solrSearcherPreprocessorSvc_;
    }));

    it('builds callUrl from a copy; original args stay templated', function() {
      var args = { q: ['#$query##'], fq: ['x:1'] };
      var searcher = {
        args: args,
        queryText: 'hello',
        url: 'http://localhost:8983/solr/select',
        config: { escapeQuery: false, numberOfRows: 10, sanitize: true, highlight: false },
        fieldList: ['id'],
        hlFieldList: [],
        HIGHLIGHTING_PRE: 'P',
        HIGHLIGHTING_POST: 'S'
      };
      solrSearcherPreprocessorSvc.prepare(searcher);
      expect(searcher.callUrl).toContain('hello');
      expect(args.q[0]).toEqual('#$query##');
      expect(args.fq[0]).toEqual('x:1');
    });
  });

  describe('vectaraSearcherPreprocessorSvc', function() {
    var vectaraSearcherPreprocessorSvc;

    beforeEach(inject(function(_vectaraSearcherPreprocessorSvc_) {
      vectaraSearcherPreprocessorSvc = _vectaraSearcherPreprocessorSvc_;
    }));

    it('queryDsl is not mutated when args.query row is mutated after prepare', function() {
      var row = { query: '#$query##', numResults: 10 };
      var searcher = {
        args: { query: [row] },
        queryText: 'qtext',
        config: { numberOfRows: 10 },
        url: 'http://api.vectara.io/v1/query'
      };
      vectaraSearcherPreprocessorSvc.prepare(searcher);
      var numBefore = searcher.queryDsl.query[0].numResults;
      row.numResults = 999;
      expect(searcher.queryDsl.query[0].numResults).toEqual(numBefore);
    });
  });
});

// =============================================================================
// C. angular.merge: null leaves, array replacement (vs Object.assign / other libs)
// =============================================================================
describe('Migration Safety: angular.merge edge cases', function() {

  it('overwrites with null from a later source (destination key becomes null)', function() {
    var out = angular.merge({}, { a: { b: 1 } }, { a: null });
    expect(out.a).toBeNull();
  });

  it('merges arrays element-by-index (does not replace the whole array; migration hazard)', function() {
    var out = angular.merge({}, { tags: [1, 2] }, { tags: [9] });
    expect(out.tags).toEqual([9, 2]);
  });
});

// =============================================================================
// D. $http response shape (fetch wrapper must supply data, status, headers)
// =============================================================================
describe('Migration Safety: $http response shape for transport success handlers', function() {

  beforeEach(module('o19s.splainer-search'));

  it('HttpPostTransportFactory passes $http response with data, status, headers()', inject(
    function(HttpPostTransportFactory, $httpBackend) {
      var Transport = HttpPostTransportFactory;
      var t = new Transport({});
      var url = 'http://example.com/post';
      $httpBackend.expectPOST(url).respond(201, { ok: true }, { 'X-Test': '1' });
      var seen = null;
      t.query(url, { a: 1 }, {}).then(function(resp) {
        seen = resp;
      });
      $httpBackend.flush();
      expect(seen.data).toEqual({ ok: true });
      expect(seen.status).toBe(201);
      expect(typeof seen.headers).toBe('function');
      expect(seen.headers('X-Test')).toBe('1');
    }
  ));
});

// =============================================================================
// E. setTimeout batching in BulkTransportFactory
// =============================================================================
describe('Migration Safety: BulkTransportFactory setTimeout scheduling', function() {

  beforeEach(module('o19s.splainer-search'));
  beforeEach(function() { jasmine.clock().install(); });
  afterEach(function() { jasmine.clock().uninstall(); });

  it('does not POST until the timer fires (batching uses setTimeout, not immediate send)', inject(
    function(BulkTransportFactory, $httpBackend) {
      var bulk = new BulkTransportFactory();
      var url = 'http://es.example.com/i/_msearch';
      bulk.query(url, { q: 1 }, {});
      $httpBackend.expectPOST(url).respond(200, { responses: [{ hits: { total: 0, hits: [] } }] });
      expect(function() {
        $httpBackend.flush();
      }).toThrow();
      jasmine.clock().tick(100);
      $httpBackend.flush();
    }
  ));
});

// =============================================================================
// F. Module public API — every injectable consumers rely on stays registered
// =============================================================================
describe('Migration Safety: Angular module public API surface', function() {

  beforeEach(module('o19s.splainer-search'));

  // Keep in sync with all .factory / .service / .value registrations under factories/, services/, values/.
  // If you add a new provider, append it here so ES-module migration cannot drop exports silently.
  var EXPECTED_INJECTABLES = [
    'activeQueries',
    'AlgoliaDocFactory',
    'AlgoliaSearcherFactory',
    'algoliaSearcherPreprocessorSvc',
    'baseExplainSvc',
    'BulkTransportFactory',
    'customHeadersJson',
    'defaultESConfig',
    'defaultSolrConfig',
    'defaultVectaraConfig',
    'DocFactory',
    'docResolverSvc',
    'EsDocFactory',
    'esExplainExtractorSvc',
    'EsSearcherFactory',
    'esSearcherPreprocessorSvc',
    'esUrlSvc',
    'explainSvc',
    'fieldSpecSvc',
    'HttpGetTransportFactory',
    'HttpJsonpTransportFactory',
    'HttpPostTransportFactory',
    'HttpProxyTransportFactory',
    'normalDocsSvc',
    'queryExplainSvc',
    'queryTemplateSvc',
    'ResolverFactory',
    'SearchApiDocFactory',
    'SearchApiSearcherFactory',
    'searchApiSearcherPreprocessorSvc',
    'searchSvc',
    'SearcherFactory',
    'SettingsValidatorFactory',
    'simExplainSvc',
    'SolrDocFactory',
    'SolrSearcherFactory',
    'solrExplainExtractorSvc',
    'solrSearcherPreprocessorSvc',
    'solrUrlSvc',
    'transportSvc',
    'TransportFactory',
    'VectaraDocFactory',
    'VectaraSearcherFactory',
    'vectaraSearcherPreprocessorSvc',
    'vectaraUrlSvc',
    'vectorSvc'
  ];

  it('registers every expected injectable', inject(function($injector) {
    EXPECTED_INJECTABLES.forEach(function(name) {
      expect($injector.has(name)).toBe(true);
    });
  }));

  it('instantiates each injectable without throwing', inject(function($injector) {
    EXPECTED_INJECTABLES.forEach(function(name) {
      expect(function() {
        $injector.get(name);
      }).not.toThrow();
    });
  }));
});

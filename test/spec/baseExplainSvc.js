'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Service: baseExplainSvc', function () {

  beforeEach(module('o19s.splainer-search'));

  var baseExplainSvc = null;
  var vectorSvc = null;

  beforeEach(inject(function (_baseExplainSvc_, _vectorSvc_) {
    baseExplainSvc = _baseExplainSvc_;
    vectorSvc = _vectorSvc_;
  }));

  // Helper: create an Explain with a simple factory that just creates base explains
  var createExplain = function(json) {
    return new baseExplainSvc.Explain(json, function(childJson) {
      return new baseExplainSvc.Explain(childJson, function() { return null; });
    });
  };

  describe('constructor', function() {

    it('parses value and description from json', function() {
      var json = { value: 2.5, description: 'test explain', details: [] };
      var expl = createExplain(json);

      expect(expl.score).toEqual(2.5);
      expect(expl.description).toEqual('test explain');
    });

    it('creates children from details', function() {
      var json = {
        value: 3.0,
        description: 'parent',
        details: [
          { value: 1.0, description: 'child 1', details: [] },
          { value: 2.0, description: 'child 2', details: [] }
        ]
      };
      var expl = createExplain(json);

      expect(expl.children.length).toEqual(2);
      expect(expl.children[0].score).toEqual(1.0);
      expect(expl.children[1].score).toEqual(2.0);
    });

    it('handles missing details gracefully', function() {
      var json = { value: 1.0, description: 'no details' };
      var expl = createExplain(json);

      expect(expl.children.length).toEqual(0);
    });

    it('filters out null children from factory', function() {
      var json = {
        value: 1.0,
        description: 'parent',
        details: [
          { value: 1.0, description: 'child', details: [] },
          { value: 0.0, description: 'will be null', details: [] }
        ]
      };
      // Factory that returns null for second child
      var callCount = 0;
      var expl = new baseExplainSvc.Explain(json, function(childJson) {
        callCount++;
        if (callCount === 2) { return null; }
        return new baseExplainSvc.Explain(childJson, function() { return null; });
      });

      expect(expl.children.length).toEqual(1);
    });
  });

  describe('contribution', function() {

    it('returns the parsed value', function() {
      var json = { value: 4.2, description: 'test', details: [] };
      var expl = createExplain(json);

      expect(expl.contribution()).toEqual(4.2);
    });
  });

  describe('explanation', function() {

    it('returns the description', function() {
      var json = { value: 1.0, description: 'my explanation', details: [] };
      var expl = createExplain(json);

      expect(expl.explanation()).toEqual('my explanation');
    });
  });

  describe('influencers', function() {

    it('returns empty array by default', function() {
      var json = { value: 1.0, description: 'test', details: [] };
      var expl = createExplain(json);

      expect(expl.influencers()).toEqual([]);
    });
  });

  describe('hasMatch', function() {

    it('returns false by default', function() {
      var json = { value: 1.0, description: 'test', details: [] };
      var expl = createExplain(json);

      expect(expl.hasMatch()).toBe(false);
    });
  });

  describe('vectorize', function() {

    it('returns a single-dimension vector with explanation as key', function() {
      var json = { value: 3.5, description: 'my match', details: [] };
      var expl = createExplain(json);

      var vec = expl.vectorize();
      expect(vec.get('my match')).toEqual(3.5);
    });
  });

  describe('matchDetails', function() {

    it('returns an object from matchDetails', function() {
      var json = { value: 1.0, description: 'leaf', details: [] };
      var expl = createExplain(json);
      var details = expl.matchDetails();

      expect(details).toBeDefined();
      expect(typeof details).toEqual('object');
    });

    it('aggregates child matchDetails (base leaves contribute empty objects)', function() {
      var fullFactory = function(childJson) {
        return new baseExplainSvc.Explain(childJson, fullFactory);
      };
      var json = {
        value: 3.0,
        description: 'parent',
        details: [
          { value: 1.0, description: 'child 1', details: [] },
          { value: 2.0, description: 'child 2', details: [] }
        ]
      };
      var expl = new baseExplainSvc.Explain(json, fullFactory);
      var details = expl.matchDetails();

      expect(Object.keys(details).length).toEqual(0);
    });
  });

  describe('toStr', function() {

    it('returns hierarchical string representation', function() {
      var json = { value: 2.0, description: 'root explain', details: [] };
      var expl = createExplain(json);

      var str = expl.toStr();
      expect(str).toContain('2');
      expect(str).toContain('root explain');
    });

    it('memoizes the string (returns same reference)', function() {
      var json = { value: 1.0, description: 'test', details: [] };
      var expl = createExplain(json);

      var str1 = expl.toStr();
      var str2 = expl.toStr();
      expect(str1).toBe(str2);
    });
  });

  describe('rawStr', function() {

    it('returns JSON string of the original json', function() {
      var json = { value: 1.5, description: 'raw test', details: [] };
      var expl = createExplain(json);

      var raw = expl.rawStr();
      expect(raw).toContain('"value":1.5');
      expect(raw).toContain('"description":"raw test"');
    });

    it('memoizes the raw string (returns same reference)', function() {
      var json = { value: 1.0, description: 'test', details: [] };
      var expl = createExplain(json);

      var raw1 = expl.rawStr();
      var raw2 = expl.rawStr();
      expect(raw1).toBe(raw2);
    });
  });
});

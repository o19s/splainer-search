'use strict';

/**
 * Tests for SearcherFactory: shared searcher shell; engines plug in via preprocessor.prepare().
 */
/*global describe,beforeEach,module,inject,it,expect*/
describe('Factory: SearcherFactory', function() {
  beforeEach(module('o19s.splainer-search'));

  var SearcherFactory;

  beforeEach(inject(function(_SearcherFactory_) {
    SearcherFactory = _SearcherFactory_;
  }));

  it('runs preprocessor.prepare on the new searcher and copies core options', function() {
    var preprocessor = {
      prepare: jasmine.createSpy('prepare')
    };
    var options = {
      fieldList:     ['f'],
      hlFieldList:   ['h'],
      url:           'http://localhost/s',
      args:          { q: ['*:*'] },
      queryText:     'q',
      config:        { numberOfRows: 10 },
      type:          'solr',
      customHeaders: '',
      HIGHLIGHTING_PRE:  '<em>',
      HIGHLIGHTING_POST: '</em>'
    };
    var s = new SearcherFactory(options, preprocessor);

    expect(preprocessor.prepare).toHaveBeenCalledWith(s);
    expect(s.fieldList).toEqual(['f']);
    expect(s.url).toBe(options.url);
    expect(s.args).toEqual(options.args);
    expect(s.docs).toEqual([]);
    expect(s.numFound).toBe(0);
    expect(s.inError).toBe(false);
  });
});

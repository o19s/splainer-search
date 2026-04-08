import { describe, it, expect, vi } from 'vitest';
import { SearcherFactory } from '../../factories/searcherFactory.js';

var SearcherConstructor = SearcherFactory();

describe('SearcherFactory', () => {
  it('runs preprocessor.prepare on the new searcher and copies core options', () => {
    var preprocessor = {
      prepare: vi.fn(),
    };
    var options = {
      fieldList: ['f'],
      hlFieldList: ['h'],
      url: 'http://localhost/s',
      args: { q: ['*:*'] },
      queryText: 'q',
      config: { numberOfRows: 10 },
      type: 'solr',
      customHeaders: '',
      HIGHLIGHTING_PRE: '<em>',
      HIGHLIGHTING_POST: '</em>',
    };
    var s = new SearcherConstructor(options, preprocessor);

    expect(preprocessor.prepare).toHaveBeenCalledWith(s);
    expect(s.fieldList).toEqual(['f']);
    expect(s.url).toBe(options.url);
    expect(s.args).toEqual(options.args);
    expect(s.docs).toEqual([]);
    expect(s.numFound).toBe(0);
    expect(s.inError).toBe(false);
  });
});

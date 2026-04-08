import { describe, it, expect } from 'vitest';
import { defaultSolrConfig } from '../../values/defaultSolrConfig.js';
import { defaultESConfig } from '../../values/defaultESConfig.js';
import { defaultVectaraConfig } from '../../values/defaultVectaraConfig.js';
import { activeQueries } from '../../values/activeQueries.js';

describe('defaultSolrConfig', () => {
  it('has expected default properties', () => {
    expect(defaultSolrConfig.sanitize).toBe(true);
    expect(defaultSolrConfig.highlight).toBe(true);
    expect(defaultSolrConfig.debug).toBe(true);
    expect(defaultSolrConfig.numberOfRows).toBe(10);
    expect(defaultSolrConfig.escapeQuery).toBe(true);
    expect(defaultSolrConfig.apiMethod).toBe('JSONP');
  });

  it('has exactly the expected keys', () => {
    expect(Object.keys(defaultSolrConfig).sort()).toEqual([
      'apiMethod',
      'debug',
      'escapeQuery',
      'highlight',
      'numberOfRows',
      'sanitize',
    ]);
  });
});

describe('defaultESConfig', () => {
  it('has expected default properties', () => {
    expect(defaultESConfig.sanitize).toBe(true);
    expect(defaultESConfig.highlight).toBe(true);
    expect(defaultESConfig.debug).toBe(true);
    expect(defaultESConfig.escapeQuery).toBe(true);
    expect(defaultESConfig.numberOfRows).toBe(10);
    expect(defaultESConfig.apiMethod).toBe('POST');
    expect(defaultESConfig.version).toBe('5.0');
  });

  it('has exactly the expected keys', () => {
    expect(Object.keys(defaultESConfig).sort()).toEqual([
      'apiMethod',
      'debug',
      'escapeQuery',
      'highlight',
      'numberOfRows',
      'sanitize',
      'version',
    ]);
  });
});

describe('defaultVectaraConfig', () => {
  it('has expected default properties', () => {
    expect(defaultVectaraConfig.apiMethod).toBe('POST');
  });

  it('has exactly the expected keys', () => {
    expect(Object.keys(defaultVectaraConfig)).toEqual(['apiMethod']);
  });
});

describe('activeQueries', () => {
  it('starts with count 0', () => {
    expect(activeQueries.count).toBe(0);
  });

  it('is a mutable singleton', () => {
    activeQueries.count = 5;
    expect(activeQueries.count).toBe(5);
    activeQueries.count = 0; // reset
  });
});

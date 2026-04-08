// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSolrExplainExtractorSvc,
  getFieldSpecSvc,
  getSolrDocConstructor,
} from './helpers/serviceFactory.js';

describe('solrExplainExtractorSvc', () => {
  var solrExplainExtractorSvc, fieldSpecSvc, mockFieldSpec, SolrDocFactory;

  beforeEach(() => {
    solrExplainExtractorSvc = getSolrExplainExtractorSvc();
    fieldSpecSvc = getFieldSpecSvc();
    SolrDocFactory = getSolrDocConstructor();
    mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1');
  });

  describe('extracts explain info for docs', () => {
    var mockSolrResp = {
      response: {
        numFound: 2,
        docs: [
          { id: 'doc1', title: 'title1' },
          { id: 'doc2', title: 'title2' },
        ],
      },
    };

    var explOtherDoc1 = {
      match: false,
      value: 0.0,
      description: 'no matching term',
    };

    var explOtherDoc2 = {
      match: true,
      value: 3.3733945,
      description: 'weight(catch_line:law in 4487) [DefaultSimilarity], result of:',
      details: [
        {
          match: true,
          value: 3.3733945,
          description: 'fieldWeight in 4487, product of:',
          details: [
            {
              match: true,
              value: 1.0,
              description: 'tf(freq=1.0), with freq of:',
              details: [{ match: true, value: 1.0, description: 'termFreq=1.0' }],
            },
            { match: true, value: 5.3974314, description: 'idf(docFreq=247, maxDocs=20148)' },
            { match: true, value: 0.625, description: 'fieldNorm(doc=4487)' },
          ],
        },
      ],
    };

    var mockSolrExplOtherResp = {
      response: {
        numFound: 2,
        docs: [
          { id: 'not_doc1', title: 'title1' },
          { id: 'not_doc2', title: 'title2' },
        ],
      },
      debug: {
        explainOther: {
          doc1: explOtherDoc1,
          doc2: explOtherDoc2,
        },
      },
    };

    it('passes two solr queries one explains the other', () => {
      var options = {
        groupedBy: '',
        group: '',
        fieldList: mockFieldSpec,
        url: 'http://example.com',
        explDict: explOtherDoc1,
        hlDict: {},
        highlightingPre: 'foo',
        highlightingPost: '/foo',
      };

      var solrDocs = [];
      mockSolrResp.response.docs.forEach(function (doc) {
        solrDocs.push(new SolrDocFactory(doc, options));
      });

      var docs = solrExplainExtractorSvc.docsWithExplainOther(
        solrDocs,
        mockFieldSpec,
        mockSolrExplOtherResp.debug.explainOther,
      );

      expect(docs.length).toBe(2);
      expect(Object.keys(docs[0].hotMatches().vecObj).length).toBe(1);
      expect(Object.keys(docs[0].hotMatches().vecObj)).toContain('no matching term');
      expect(docs[0].hotMatches().vecObj['no matching term']).toBe(0);
      expect(docs[0].score()).toBe(0);
      expect(Object.keys(docs[1].hotMatches().vecObj).length).toBe(1);
      expect(docs[1].score()).toBe(3.3733945);
    });
  });

  describe('getOverridingExplain edge cases', () => {
    it('returns null when explainData is null', () => {
      var result = solrExplainExtractorSvc.getOverridingExplain(
        { id: 'doc1' },
        mockFieldSpec,
        null,
      );
      expect(result).toBeNull();
    });

    it('returns null when explainData is undefined', () => {
      var result = solrExplainExtractorSvc.getOverridingExplain(
        { id: 'doc1' },
        mockFieldSpec,
        undefined,
      );
      expect(result).toBeNull();
    });

    it('returns null when doc id is not in explainData', () => {
      var explainData = { other_id: { value: 1.0 } };
      var result = solrExplainExtractorSvc.getOverridingExplain(
        { id: 'doc1' },
        mockFieldSpec,
        explainData,
      );
      expect(result).toBeNull();
    });

    it('returns null when doc has no id field', () => {
      var explainData = { doc1: { value: 1.0 } };
      var result = solrExplainExtractorSvc.getOverridingExplain(
        { title: 'no id' },
        mockFieldSpec,
        explainData,
      );
      expect(result).toBeNull();
    });

    it('returns explain data when id matches', () => {
      var explain = { value: 2.5, description: 'test weight' };
      var explainData = { doc1: explain };
      var result = solrExplainExtractorSvc.getOverridingExplain(
        { id: 'doc1' },
        mockFieldSpec,
        explainData,
      );
      expect(result).toEqual(explain);
    });

    it('returns null when explainData is an empty object', () => {
      var result = solrExplainExtractorSvc.getOverridingExplain({ id: 'doc1' }, mockFieldSpec, {});
      expect(result).toBeNull();
    });
  });

  describe('docsWithExplainOther edge cases', () => {
    it('returns empty array when docs is empty', () => {
      var result = solrExplainExtractorSvc.docsWithExplainOther([], mockFieldSpec, {});
      expect(result).toEqual([]);
    });

    it('handles docs with no matching explain data', () => {
      var options = {
        groupedBy: '',
        group: '',
        fieldList: mockFieldSpec,
        url: 'http://example.com',
        explDict: {},
        hlDict: {},
        highlightingPre: 'em',
        highlightingPost: '/em',
      };
      var solrDocs = [new SolrDocFactory({ id: 'doc1', title: 'Test' }, options)];
      var result = solrExplainExtractorSvc.docsWithExplainOther(solrDocs, mockFieldSpec, {});
      expect(result.length).toBe(1);
    });
  });
});

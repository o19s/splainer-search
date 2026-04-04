import { describe, it, expect } from 'vitest';
import { fieldSpecSvcConstructor } from '../../services/fieldSpecSvc.js';
import utilsSvcStub from './helpers/utilsSvcStub.js';

function createFieldSpecSvc() {
  return new fieldSpecSvcConstructor(utilsSvcStub);
}

describe('fieldSpecSvc', () => {
  it('creates a field spec with default id', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('myTitle');
    expect(fs.id).toBe('id');
    expect(fs.title).toBe('myTitle');
  });

  it('uses explicit id when provided', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:docId myTitle');
    expect(fs.id).toBe('docId');
    expect(fs.title).toBe('myTitle');
  });

  it('handles null/empty field spec with defaults', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec(null);
    expect(fs.id).toBe('id');
    expect(fs.title).toBe('id');
  });

  it('handles wildcard subs', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('myTitle sub:*');
    expect(fs.subs).toBe('*');
    expect(fs.fieldList()).toBe('*');
  });

  it('parses highlight fields', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('myTitle hl:body');
    expect(fs.highlights).toContain('body');
  });

  it('parses media embeds', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('myTitle media:imageUrl');
    expect(fs.embeds).toContain('imageUrl');
  });

  it('parses function fields', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('myTitle func:$score');
    expect(fs.functions).toContain('score:$score');
  });

  it('iterates over fields with forEachField', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('myTitle sub:detail');
    var fields = [];
    fs.forEachField(function (f) { fields.push(f); });
    expect(fields).toContain('myTitle');
    expect(fields).toContain('detail');
  });

  it('forEachField works when no optional arrays exist', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:myId myTitle');
    var fields = [];
    fs.forEachField(function (f) { fields.push(f); });
    expect(fields).toContain('myTitle');
  });
});

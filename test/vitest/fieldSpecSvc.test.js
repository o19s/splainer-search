import { describe, it, expect } from 'vitest';
import { fieldSpecSvcConstructor } from '../../services/fieldSpecSvc.js';
import utilsSvcStub from './helpers/utilsSvcStub.js';

function createFieldSpecSvc() {
  return new fieldSpecSvcConstructor(utilsSvcStub);
}

describe('fieldSpecSvc', () => {
  it('default id is id', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('');
    expect(fs.id).toEqual('id');
  });

  it('first field is title field', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('atitlefield');
    expect(fs.title).toEqual('atitlefield');
  });

  it('extra fields are subfields', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('atitlefield subfield1 subfield2');
    expect(fs.title).toEqual('atitlefield');
    expect(fs.subs).toContain('subfield1');
    expect(fs.subs).toContain('subfield2');
  });

  it('id fields specified', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2');
    expect(fs.id).toEqual('foo_id');
    expect(fs.title).toEqual('atitlefield');
    expect(fs.subs).toContain('subfield1');
    expect(fs.subs).toContain('subfield2');
  });

  it('second specs ignored', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2 id:foo_id');
    expect(fs.id).toEqual('foo_id');
    expect(fs.title).toEqual('atitlefield');
    expect(fs.subs).toContain('subfield1');
    expect(fs.subs).toContain('subfield2');
  });

  it('extracts a thumb property', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id atitlefield subfield1 thumb:foo_img subfield2');
    expect(fs.id).toEqual('foo_id');
    expect(fs.title).toEqual('atitlefield');
    expect(fs.thumb).toEqual('foo_img');
    expect(fs.subs).toContain('subfield1');
    expect(fs.subs).toContain('subfield2');
  });

  it('extracts an image property', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id atitlefield subfield1 image:foo_img subfield2');
    expect(fs.id).toEqual('foo_id');
    expect(fs.title).toEqual('atitlefield');
    expect(fs.image).toEqual('foo_img');
    expect(fs.subs).toContain('subfield1');
    expect(fs.subs).toContain('subfield2');
  });

  it('extracts media fields', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id atitlefield subfield1 media:media1 media:media2 subfield2');
    expect(fs.id).toEqual('foo_id');
    expect(fs.title).toEqual('atitlefield');
    expect(fs.embeds).toContain('media1');
    expect(fs.embeds).toContain('media2');
    expect(fs.subs).toContain('subfield1');
    expect(fs.subs).toContain('subfield2');
  });

  it('extracts translations fields', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id atitlefield subfield1 translate:subfield2');
    expect(fs.id).toEqual('foo_id');
    expect(fs.title).toEqual('atitlefield');
    expect(fs.subs).toContain('subfield1');
    expect(fs.subs).not.toContain('subfield2');
    expect(fs.translations).toContain('subfield2');
  });

  it('extracts unabridged fields', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id atitlefield subfield1 unabridged:subfield2');
    // NB: current code stores these in `unabridgeds` (plural) — main had a
    // `hasOwnProperty('unabridged')` typo that this branch fixed.
    expect(fs.id).toEqual('foo_id');
    expect(fs.title).toEqual('atitlefield');
    expect(fs.subs).toContain('subfield1');
    expect(fs.subs).not.toContain('subfield2');
    expect(fs.unabridgeds).toContain('subfield2');
  });

  it('gets plain field list', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2 image:imagefield thumb:foo_img media:media1');
    expect(fs.fields).toContain('foo_id');
    expect(fs.fields).toContain('atitlefield');
    expect(fs.fields).toContain('subfield1');
    expect(fs.fields).toContain('subfield2');
    expect(fs.fields).toContain('foo_img');
    expect(fs.fields).toContain('media1');
    expect(fs.fields).toContain('imagefield');
  });

  it('fields has id when no id specified', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('atitlefield');
    expect(fs.fields).toContain('id');
  });

  it('iterates all non-id fields', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2 thumb:foo_img');
    var fieldsIterated = [];
    fs.forEachField(function (fieldName) { fieldsIterated.push(fieldName); });
    expect(fieldsIterated).toContain('atitlefield');
    expect(fieldsIterated).toContain('subfield1');
    expect(fieldsIterated).toContain('subfield2');
    expect(fieldsIterated).toContain('foo_img');
    expect(fieldsIterated).not.toContain('foo_id');
  });

  it('returns field list', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('atitlefield');
    var fieldList = fs.fieldList();
    expect(fieldList).toContain('atitlefield');
    expect(fieldList).toContain('id');
  });

  it('allows commas', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id, atitlefield,thumb:foo_img');
    expect(fs.id).toEqual('foo_id');
    expect(fs.title).toEqual('atitlefield');
    expect(fs.thumb).toEqual('foo_img');
  });

  it('ignores +', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id,+atitlefield,+thumb:foo_img');
    expect(fs.id).toEqual('foo_id');
    expect(fs.title).toEqual('atitlefield');
    expect(fs.thumb).toEqual('foo_img');
  });

  it('understands * for sub fields', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id, atitlefield, *');
    expect(fs.subs).toEqual('*');
    expect(fs.fieldList()).toEqual('*');
  });

  it('correctly transforms *', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('*');
    expect(fs.subs).toEqual('*');
    expect(fs.id).toEqual('id');
    expect(fs.title).toEqual('id');
    expect(fs.fieldList()).toEqual('*');
  });

  it('correctly transforms *,score', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('*,score');
    expect(fs.subs).toEqual('*');
    expect(fs.id).toEqual('id');
    expect(fs.title).toEqual('id');
    expect(fs.fieldList()).toEqual('*');
  });

  it('correctly transforms empty / whitespace', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec(' \t ');
    expect(fs.subs).toEqual('*');
    expect(fs.id).toEqual('id');
    expect(fs.title).toEqual('id');
    expect(fs.fieldList()).toEqual('*');
  });

  it('handles null field spec with defaults', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec(null);
    expect(fs.id).toEqual('id');
    expect(fs.title).toEqual('id');
  });

  it('preserves certain computed fields', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('catch_line,text,function:someFunctionQuery');
    expect(fs.subs).toContain('text');
    expect(fs.functions).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fs.id).toEqual('id');
    expect(fs.title).toEqual('catch_line');
    var fl = fs.fieldList();
    expect(fl).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fl).toContain('text');
    expect(fl).toContain('catch_line');
  });

  it('tolerates $ in function field name', () => {
    // Integration check: a `$`-prefixed function name must coexist correctly
    // with id/title/sub parsing — i.e. the parser must not let the `$` leak
    // into the title/sub branch.
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('catch_line,text,function:$someFunctionQuery');
    expect(fs.subs).toContain('text');
    expect(fs.functions).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fs.id).toEqual('id');
    expect(fs.title).toEqual('catch_line');

    var fieldList = fs.fieldList();
    expect(fieldList).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fieldList).toContain('text');
    expect(fieldList).toContain('catch_line');
  });

  it('respects function aliases (func: and f:)', () => {
    // Both `func:` and `f:` must produce the same canonical
    // `name:$name` form *and* leave the rest of the spec parsing intact.
    var svc = createFieldSpecSvc();

    var fs1 = svc.createFieldSpec('catch_line,text,func:someFunctionQuery');
    expect(fs1.subs).toContain('text');
    expect(fs1.functions).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fs1.id).toEqual('id');
    expect(fs1.title).toEqual('catch_line');
    var fl1 = fs1.fieldList();
    expect(fl1).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fl1).toContain('text');
    expect(fl1).toContain('catch_line');

    var fs2 = svc.createFieldSpec('catch_line,text,f:someFunctionQuery');
    expect(fs2.subs).toContain('text');
    expect(fs2.functions).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fs2.id).toEqual('id');
    expect(fs2.title).toEqual('catch_line');
    var fl2 = fs2.fieldList();
    expect(fl2).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fl2).toContain('text');
    expect(fl2).toContain('catch_line');
  });

  it('allows periods in a field name', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id, foo.bar');
    expect(fs.id).toEqual('foo_id');
    expect(fs.fieldList()).toContain('foo.bar');
  });

  it('respects escaping periods by wrapping in quotes', () => {
    var svc = createFieldSpecSvc();
    var fs1 = svc.createFieldSpec('id:foo_id, "foo.bar"');
    expect(fs1.id).toEqual('foo_id');
    expect(fs1.fieldList()).toContain('"foo.bar"');

    var fs2 = svc.createFieldSpec("id:foo_id, 'foo.bar'");
    expect(fs2.id).toEqual('foo_id');
    expect(fs2.fieldList()).toContain("'foo.bar'");
  });

  it('hl switch is working', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id, nohighlight, title:hl:titleCombo highlight:regular foo.bar');
    var hl = fs.highlightFieldList();
    expect(hl).toContain('regular');
    expect(hl).toContain('titleCombo');
    expect(hl).not.toContain('nohighlight');
  });

  it('handles json definition for images', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id atitlefield {"name": "image_url", "type":"image", "prefix": "http://example.org/images", "height": 250} subfield2');
    expect(fs.id).toEqual('foo_id');
    expect(fs.title).toEqual('atitlefield');
    expect(fs.image).toContain('image_url');
    expect(fs.image_options).toEqual({ prefix: 'http://example.org/images', height: 250 });
    expect(fs.subs).toContain('subfield2');
  });

  it('handles json definition for thumb', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:foo_id atitlefield {"name": "image_url", "type":"thumb", "prefix": "http://example.org/thumbs", "height": 250} subfield2');
    expect(fs.id).toEqual('foo_id');
    expect(fs.title).toEqual('atitlefield');
    expect(fs.thumb).toContain('image_url');
    expect(fs.thumb_options).toEqual({ prefix: 'http://example.org/thumbs', height: 250 });
    expect(fs.subs).toContain('subfield2');
  });

  it('forEachField works when no optional arrays exist', () => {
    var svc = createFieldSpecSvc();
    var fs = svc.createFieldSpec('id:myId myTitle');
    var fields = [];
    fs.forEachField(function (f) { fields.push(f); });
    expect(fields).toContain('myTitle');
  });
});

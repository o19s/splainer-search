'use strict';

/*global describe,beforeEach,inject,it,expect*/
describe('Service: fieldSpecSvc', function () {

  // load the service's module
  beforeEach(module('o19s.splainer-search'));

  // instantiate service
  var fieldSpecSvc;
  beforeEach(inject(function (_fieldSpecSvc_) {
    fieldSpecSvc = _fieldSpecSvc_;
  }));

  it('default id is id', function () {
    var fieldSpec = fieldSpecSvc.createFieldSpec('');
    expect(fieldSpec.id).toEqual('id');
  });

  it('first field is title field', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('atitlefield');
    expect(fieldSpec.title).toEqual('atitlefield');
  });

  it('extra fields are subfields', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('atitlefield subfield1 subfield2');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.subs).toContain('subfield1');
    expect(fieldSpec.subs).toContain('subfield2');
  });

  it('id fields specified', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2');
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.subs).toContain('subfield1');
    expect(fieldSpec.subs).toContain('subfield2');
  });

  it('second specs ignored', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2 id:foo_id');
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.subs).toContain('subfield1');
    expect(fieldSpec.subs).toContain('subfield2');
  });

  it('extracts a thumb property', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2 id:foo_id thumb:foo_img');
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldSpec.thumb).toEqual('foo_img');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.subs).toContain('subfield1');
    expect(fieldSpec.subs).toContain('subfield2');
  });

  it('extracts a image property', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2 id:foo_id image:foo_img');
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldSpec.image).toEqual('foo_img');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.subs).toContain('subfield1');
    expect(fieldSpec.subs).toContain('subfield2');
  });

  it('extracts media fields', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2 id:foo_id media:media1 media:media2');
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldSpec.embeds).toContain('media1');
    expect(fieldSpec.embeds).toContain('media2');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.subs).toContain('subfield1');
    expect(fieldSpec.subs).toContain('subfield2');
  });

  it('extracts translations fields', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield subfield1 translate:subfield2 id:foo_id');
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.subs).toContain('subfield1');
    expect(fieldSpec.translations).toContain('subfield2');
  });


  it('gets plain field list', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2 id:foo_id image:imagefield thumb:foo_img media:media1');
    expect(fieldSpec.fields).toContain('foo_id');
    expect(fieldSpec.fields).toContain('atitlefield');
    expect(fieldSpec.fields).toContain('subfield1');
    expect(fieldSpec.fields).toContain('subfield2');
    expect(fieldSpec.fields).toContain('foo_img');
    expect(fieldSpec.fields).toContain('media1');
    expect(fieldSpec.fields).toContain('imagefield');
  });

  it('fields has id when no id specified', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('atitlefield');
    expect(fieldSpec.fields).toContain('id');
  });

  it('iterates all non-id fields', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield subfield1 subfield2 id:foo_id thumb:foo_img');
    var fieldsIterated = [];
    fieldSpec.forEachField(function(fieldName) {
      fieldsIterated.push(fieldName);
    });
    expect(fieldsIterated).toContain('atitlefield');
    expect(fieldsIterated).toContain('subfield1');
    expect(fieldsIterated).toContain('subfield2');
    expect(fieldsIterated).toContain('foo_img');
    expect(fieldsIterated).not.toContain('foo_id');
  });

  it('returns field list', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('atitlefield');
    var fieldList = fieldSpec.fieldList();
    expect(fieldList).toContain('atitlefield');
    expect(fieldList).toContain('id');
  });

  it('allows commas', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id, atitlefield,thumb:foo_img');
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.thumb).toEqual('foo_img');
  });

  it('ignores +', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id,+atitlefield,+thumb:foo_img');
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.thumb).toEqual('foo_img');
  });

  it('understands * for sub fields', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id, atitlefield, *');
    expect(fieldSpec.subs).toEqual('*');
    expect(fieldSpec.fieldList()).toEqual('*');
  });

  it('correctly transforms *', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('*');
    expect(fieldSpec.subs).toEqual('*');
    expect(fieldSpec.id).toEqual('id');
    expect(fieldSpec.title).toEqual('id');
    expect(fieldSpec.fieldList()).toEqual('*');
  });

  it('correctly transforms *,score', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('*,score');
    expect(fieldSpec.subs).toEqual('*');
    expect(fieldSpec.id).toEqual('id');
    expect(fieldSpec.title).toEqual('id');
    expect(fieldSpec.fieldList()).toEqual('*');
  });

  it('correctly transforms empty', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec(' \t ');
    expect(fieldSpec.subs).toEqual('*');
    expect(fieldSpec.id).toEqual('id');
    expect(fieldSpec.title).toEqual('id');
    expect(fieldSpec.fieldList()).toEqual('*');
  });

  it('preserves certain computed fields', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('catch_line,text,function:someFunctionQuery');
    expect(fieldSpec.subs).toContain('text');
    expect(fieldSpec.functions).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fieldSpec.id).toEqual('id');
    expect(fieldSpec.title).toEqual('catch_line');

    var fieldList = fieldSpec.fieldList();
    expect(fieldList).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fieldList).toContain('text');
    expect(fieldList).toContain('catch_line');
  });

  it('tolerates $ in function field name', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('catch_line,text,function:$someFunctionQuery');
    expect(fieldSpec.subs).toContain('text');
    expect(fieldSpec.functions).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fieldSpec.id).toEqual('id');
    expect(fieldSpec.title).toEqual('catch_line');

    var fieldList = fieldSpec.fieldList();
    expect(fieldList).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fieldList).toContain('text');
    expect(fieldList).toContain('catch_line');
  });

  it('respects function aliases', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('catch_line,text,func:someFunctionQuery');
    expect(fieldSpec.subs).toContain('text');
    expect(fieldSpec.functions).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fieldSpec.id).toEqual('id');
    expect(fieldSpec.title).toEqual('catch_line');

    var fieldList = fieldSpec.fieldList();
    expect(fieldList).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fieldList).toContain('text');
    expect(fieldList).toContain('catch_line');

    fieldSpec = fieldList = undefined;
    fieldSpec = fieldSpecSvc.createFieldSpec('catch_line,text,f:someFunctionQuery');
    expect(fieldSpec.subs).toContain('text');
    expect(fieldSpec.functions).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fieldSpec.id).toEqual('id');
    expect(fieldSpec.title).toEqual('catch_line');

    fieldList = fieldSpec.fieldList();
    expect(fieldList).toContain('someFunctionQuery:$someFunctionQuery');
    expect(fieldList).toContain('text');
    expect(fieldList).toContain('catch_line');
  });

  it('allows periods in a field name', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id, foo.bar');
    var fieldList = fieldSpec.fieldList();
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldList).toContain('foo.bar');
  });

  it('respects escaping periods by wrapping in quotes', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id, "foo.bar"');
    var fieldList = fieldSpec.fieldList();
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldList).toContain('"foo.bar"');

    fieldSpec = fieldSpecSvc.createFieldSpec("id:foo_id, 'foo.bar'");
    fieldList = fieldSpec.fieldList();
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldList).toContain("'foo.bar'");
  });

  // Note, we may eliminate this as wonky and unused.  Eric.
  it('hl switch is working', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id, nohighlight, title:hl:titleCombo highlight:regular foo.bar');
    var hlFieldList = fieldSpec.highlightFieldList();
    expect(hlFieldList).toContain('regular');
    expect(hlFieldList).toContain('titleCombo');
    expect(hlFieldList).not.toContain('nohighlight');
  });

  it('handles json definition for images', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield {"name": "image_url", "type":"image", "prefix": "http://example.org/images", "height": 250} subfield2');
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.image).toContain('image_url');
    expect(fieldSpec.image_options).toEqual({prefix: "http://example.org/images", height: 250});
    expect(fieldSpec.subs).toContain('subfield2');
  });
  
  it('handles json definition for thumb', function() {
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:foo_id atitlefield {"name": "image_url", "type":"thumb", "prefix": "http://example.org/thumbs", "height": 250} subfield2');
    expect(fieldSpec.id).toEqual('foo_id');
    expect(fieldSpec.title).toEqual('atitlefield');
    expect(fieldSpec.thumb).toContain('image_url');
    expect(fieldSpec.thumb_options).toEqual({prefix: "http://example.org/thumbs", height: 250});
    expect(fieldSpec.subs).toContain('subfield2');
  });  

});

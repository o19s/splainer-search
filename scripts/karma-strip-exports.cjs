/**
 * Tiny Karma preprocessor: strips ESM `export` keywords so files parse as scripts.
 * Much lighter than esbuild — does not interfere with Istanbul coverage instrumentation.
 */
'use strict';

function createStripExportsPreprocessor() {
  return function (content, file, done) {
    done(content.replace(/^export\s+/gm, ''));
  };
}
createStripExportsPreprocessor.$inject = [];

module.exports = {
  'preprocessor:strip-exports': ['factory', createStripExportsPreprocessor],
};

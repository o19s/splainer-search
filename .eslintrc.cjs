/**
 * ESLint for library sources (same globs as `npm run lint` / Grunt `eslint`).
 *
 * - `eslint:recommended` — bug-prone patterns; no JSHint-era style rules.
 * - `eslint-config-prettier` — turn off stylistic rules that conflict with Prettier.
 * - Assumes modern runtimes (ES2023+); Angular 1.x globals for this codebase.
 */
/* eslint-env node */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2023: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  globals: {
    angular: 'readonly',
    inject: 'readonly',
    Promise: 'readonly',
    URI: 'readonly',
  },
  rules: {
    // Stricter than `eslint:recommended` defaults: allow intentional unused args/catches via `_` prefix.
    'no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'after-used',
        caughtErrors: 'all',
        ignoreRestSiblings: true,
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
  },
  overrides: [
    {
      // Source files migrated to ES modules (Phase 2+)
      files: ['values/**/*.js', 'services/**/*.js', 'factories/**/*.js'],
      parserOptions: {
        sourceType: 'module',
      },
    },
    {
      files: ['Gruntfile.cjs', 'scripts/**/*.cjs'],
      env: {
        node: true,
      },
    },
    {
      files: ['karma.coverage.conf.cjs', 'karma.conf.js', 'karma.debug.conf.js'],
      env: {
        node: true,
      },
    },
    {
      // Vitest config is ESM (import/export); default project parser is script.
      files: ['vitest.config.js'],
      env: {
        node: true,
      },
      parserOptions: {
        sourceType: 'module',
      },
    },
    {
      files: ['test/spec/**/*.js', 'test/mock/**/*.js'],
      env: {
        jasmine: true,
      },
      globals: {
        module: 'readonly',
      },
    },
    {
      files: ['test/vitest/**/*.js'],
      parserOptions: {
        sourceType: 'module',
      },
      env: {
        es2023: true,
      },
    },
    {
      // Node-driven integration scripts (CommonJS require, __dirname, process).
      files: ['test/integration/**/*.js'],
      env: {
        node: true,
      },
    },
  ],
};

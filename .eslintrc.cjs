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
      files: ['Gruntfile.cjs'],
      env: {
        node: true,
      },
    },
    {
      files: ['test/**/*.js'],
      env: {
        jasmine: true,
      },
      globals: {
        module: 'readonly',
      },
    },
  ],
};

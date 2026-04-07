/**
 * ESLint for library sources (same globs as `npm run lint`).
 *
 * - `eslint:recommended` — bug-prone patterns.
 * - `eslint-config-prettier` — turn off stylistic rules that conflict with Prettier.
 * - Package is "type": "module" — all .js files are ESM by default.
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
    sourceType: 'module',
  },
  globals: {
    Promise: 'readonly',
  },
  rules: {
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
      files: ['.eslintrc.cjs'],
      env: {
        node: true,
      },
      parserOptions: {
        sourceType: 'script',
      },
    },
    {
      files: ['vitest.config.js'],
      env: {
        node: true,
      },
    },
    {
      files: ['test/vitest/**/*.js'],
      env: {
        es2023: true,
      },
    },
    {
      // Node-driven integration scripts.
      files: ['test/integration/**/*.js'],
      env: {
        node: true,
      },
    },
    {
      files: ['build.js'],
      env: {
        node: true,
      },
    },
  ],
};

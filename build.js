/**
 * Build script — replaces Grunt concat.
 *
 * Produces (under **dist/**):
 * - **dist/splainer-search.js** — IIFE from `index.js` (`globalThis.SplainerSearch`): constructors
 *   and factories for low-level / tree-shaking consumers.
 * - **dist/splainer-search-wired.js** — IIFE from `wired.js` (`globalThis.SplainerSearchWired`): the
 *   same pre-wired graph as ESM `splainer-search/wired.js` (Splainer, Quepid, importmap).
 *
 * Load **URI.js** before either bundle (`<script>` consumers).
 *
 * Usage:  node build.js
 */
import { build } from 'esbuild';

var common = {
  bundle: true,
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  // urijs is loaded globally via <script> by IIFE consumers.
  alias: { urijs: './shims/urijs-global.js' },
};

await build({
  ...common,
  entryPoints: ['index.js'],
  format: 'iife',
  globalName: 'SplainerSearch',
  outfile: 'dist/splainer-search.js',
  banner: {
    js: '/* splainer-search — bundled IIFE (index). Do not edit by hand. */',
  },
});

await build({
  ...common,
  entryPoints: ['wired.js'],
  format: 'iife',
  globalName: 'SplainerSearchWired',
  outfile: 'dist/splainer-search-wired.js',
  banner: {
    js: '/* splainer-search — bundled IIFE (wired). Do not edit by hand. */',
  },
});

console.log('Built dist/splainer-search.js and dist/splainer-search-wired.js');

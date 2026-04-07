/**
 * Build script — replaces Grunt concat.
 *
 * Produces splainer-search.js as an IIFE bundle from the ESM entry point.
 * All exports are attached to globalThis.SplainerSearch for <script> tag consumers.
 *
 * Usage:  node build.js
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['index.js'],
  bundle: true,
  format: 'iife',
  globalName: 'SplainerSearch',
  outfile: 'splainer-search.js',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  // urijs is loaded globally via <script> by IIFE consumers.
  // Map `import URI from 'urijs'` → `globalThis.URI`.
  alias: { urijs: './shims/urijs-global.js' },
  banner: {
    js: '/* splainer-search — bundled IIFE build. Do not edit by hand. */',
  },
});

console.log('Built splainer-search.js');

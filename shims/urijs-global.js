// Shim for IIFE build: resolve `import URI from 'urijs'` to the global URI
// loaded via <script src="urijs/src/URI.min.js">.
export default globalThis.URI;

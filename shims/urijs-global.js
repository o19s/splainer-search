// Shim for IIFE build: resolve `import URI from 'urijs'` to the global URI
// loaded via <script src="urijs/src/URI.min.js">. Lazy so script load order
// doesn't matter — only the sole call site `new URI(url)` is supported.
export default function URI(url) { return new globalThis.URI(url); }

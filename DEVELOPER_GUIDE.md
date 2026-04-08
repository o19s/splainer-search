## Development Notes

Splainer-search is a plain ESM JavaScript library. It requires only `npm` and **Node.js 20.12+** (`package.json` `engines`; Vitest 4’s bundler depends on `util.styleText`). With [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the repo root to pick up **`.nvmrc`** (currently **22**). Grunt, Karma, and AngularJS were removed in the 3.0 migration.

* On a Mac [install Node.js via Homebrew](http://thechangelog.com/install-node-js-with-homebrew-on-os-x/)
* On Ubuntu [install Node.js via NodeSource](https://github.com/nodesource/distributions)

To install dependencies and run the unit tests (Vitest):

```
npm install
npm test
```

Other useful scripts:

```
npm run lint               # ESLint (source, shims, tests, vitest.config.js — see package.json)
npm run test:integration   # node: chunked-resolver fetch integration
npm run test:integration:demo   # node: Quepid demo endpoints (optional)
npm run test:ci            # lint + unit + integration (what CI runs before build)
npm run pack:check         # build + npm pack --dry-run (verify dist/ lands in tarball)
npm run format             # prettier --write .
npm run format:check       # prettier --check .
```

Tip: use `it.only` / `describe.only` in a Vitest spec to focus on a single test, or pass a path to `npx vitest run test/vitest/yourSpec.test.js`.

To build the IIFE bundles consumed via `<script>` tags:

```
npm run build
```

The build is driven by [build.js](build.js) (esbuild). It produces **`dist/splainer-search.js`** (`globalThis.SplainerSearch`, constructor-level `index.js` exports) and **`dist/splainer-search-wired.js`** (`globalThis.SplainerSearchWired`, same as ESM **`wired.js`**). Load [urijs](https://medialize.github.io/URI.js/) before either bundle.

The ESM subpath **`splainer-search/wired.js`** is the supported pre-wired graph for apps (Splainer 2, Quepid). Its implementation lives in [wired/wiring.js](wired/wiring.js); Vitest uses the same graph via [test/vitest/helpers/serviceFactory.js](test/vitest/helpers/serviceFactory.js).

### Release Process

We use [`np`](https://github.com/sindresorhus/np) to publish splainer-search to npmjs.org.  

1. You need to update the
`CHANGELOG.md` with your new version and the date, but you don't need to touch `package.json`,
the `np` script bumps that file!   Check that file in.

2. Create a granular access token on npmjs.com with at least these permissions: Publish (for the package scope you need) and Read (for install during the publish flow). Set it to “automation” type if offered; that avoids 2FA prompts.  
  - Add it to npm config via `npm config set //registry.npmjs.org/:_authToken=YOUR_TOKEN`
  - Test it via `npm whoami`



3. Now install the 'np' script if you don't have it, and run it to create the release:

```
npm install --global np
np --no-2fa
```

4. This will also pop open a browser window on GitHub to create a new release for the project.
Use the "Generate Release Notes" button on GitHub to make the template, and then paste the contents of `CHANGELOG.md` into the _What's Changed_ section.

**IIFE bundles in the tarball:** `dist/splainer-search.js` / `dist/splainer-search-wired.js` and their **`.map`** files are **not** committed to git but **are** listed in `package.json` `"files"` for the npm pack. **`prepublishOnly`** runs `npm run build` automatically on `npm publish` (and `npm pack`), so the tarball includes them unless scripts are disabled (e.g. `npm publish --ignore-scripts`). Run **`npm run pack:check`** before a release to confirm the dry-run pack lists those files. Run `npm run build` locally anytime to verify the bundles; CI also runs the build after `test:ci` (see [.circleci/config.yml](.circleci/config.yml)).

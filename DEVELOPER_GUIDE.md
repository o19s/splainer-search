## Development Notes

Splainer-search is a plain ESM JavaScript library. It requires only `npm` and **Node.js 18+** (`package.json` `engines`). Grunt, Karma, and AngularJS were removed in the 3.0 migration.

* On a Mac [install Node.js via Homebrew](http://thechangelog.com/install-node-js-with-homebrew-on-os-x/)
* On Ubuntu [install Node.js via NodeSource](https://github.com/nodesource/distributions)

To install dependencies and run the unit tests (Vitest):

```
npm install
npm test
```

Other useful scripts:

```
npm run lint               # ESLint over services/, factories/, values/
npm run test:integration   # node-based integration test against a real chunked fetch
npm run test:ci            # lint + unit + integration (what CI should run)
npm run format             # prettier --write
```

Tip: use `it.only` / `describe.only` in a Vitest spec to focus on a single test, or pass a path to `npx vitest run test/vitest/yourSpec.test.js`.

To build the IIFE bundle (`splainer-search.js`) consumed via `<script>` tags:

```
npm run build
```

The build is driven by [build.js](build.js) (esbuild). It produces `splainer-search.js` exposing all exports under `globalThis.SplainerSearch`. Consumers using `<script src=".../splainer-search.js">` must also load [urijs](https://medialize.github.io/URI.js/) before splainer-search.
### Release Process

We use NP to publish splainer-search to npmjs.org.  

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
Use the "Generate Release Notes" button on Github to make the template, and then paste in the contents of `CHANGELOG.md` into the _Whats Changed_ section.

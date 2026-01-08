## Development Notes

Splainer-search is written using AngularJS project. It requires `npm` and `grunt`:

* On a Mac [follow these instructions](http://thechangelog.com/install-node-js-with-homebrew-on-os-x/)
* On Ubuntu [follow these instructions](https://rtcamp.com/tutorials/nodejs/node-js-npm-install-ubuntu/)
* Use npm to install Grunt globally on your system (may require sudo)

Make sure you have a recent Node.js version installed, older versions won't work.  Version 20 or newer.

```
npm install -g grunt-cli
```

To run the tests:

```
npm install
npm test
```
Tip: add an `f` in front of any `describe` or `it` in your unit tests to run just that unit test.

We need to build a `splainer-search.js` file as part of the build.

```
npm run-script build
```
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

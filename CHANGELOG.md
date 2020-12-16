Version numbers correspond to `package.json` version

# 2.6.7-2.6.9 (12/16/2020)
- Solr - Disable highlight unless enabled in the fieldSpec

# 2.6.6 (12/09/2020)
- Allow full query override for ES explain other

# 2.6.4 (11/30/2020)
- Allow override of defType for explainOther in solr searcher

# 2.6.3 (10/21/2020)
- Fixed issue with documents having no title causing splainer to blow up.

# 2.6.2 (10/05/2020)
- Lots of work on breaking out highlighting into a better structure, after fighting with little fixes for a while.

# 2.5.9 (04/27/2020)
- Highlighting on dates and integers in Solr causes an error.  Work around is to append `hl.method=unified` to calls to Solr.  https://github.com/o19s/splainer-search/pull/84
- a common pattern in Solr schemas is to normalize fields with dots: `foo.bar`, however if you have a array or dictionary of JSON, we want to navigate that.  Now we check if the key exists with a dot in it, if not, we use that as a selector to pluck out the data in the nested JSON that we need.  https://github.com/o19s/splainer-search/pull/83

# 2.5.8 (04/16/2020)
- Fix rendering logic to handle Arrays and JSON objects so you don't get `"[object Object]"` in the UI. Another great fix by @CgamesPlay!
- Migrate to Puppeteer for browser testing.  No more PhantomJS.   Lots of other dependencies cleaned up, and some legacy files from when this was a full blown app instead of a library removed.  `package-lock.json` dropped from 9663 lines to 4788 lines.

# 2.5.7
- Allow http://username:password@example.com:9200/ in URL to work by converting to Authorization header for Elasticsearch.   Thanks @CGamesPlay for fix.

# 2.5.6
- Support extracting media fields that have fieldspec media:

# 2.5.5
- This time with the `splainer-search.js` file!

# 2.5.4
- DO NOT USE THIS VERSION, we missed the compiled file from the package ;-)
- Remove compiled `splainer-search.js` from github

# 2.5.3
- Explain Other on ES 6 and 7 Broken.
- Fix for wildcard fieldspec in ES, allow * as a fieldspec

# 2.5.2
_There was a hiatus up through 2.5.2 in maintaining this file._
- Remove Vagrant support from project.
- Support how ES 7 reports total docs found compared to how ES 6 and prior did.

# 2.2.3
- Bugfix: fixes bug when field name conflicts with url function name

# 2.2.2
- Bugfix: fixes formatting of json fields instead of returning [object Object]

# 2.2.1
- Bugfix: check for whether field name had a '.' was matching everything. D'oh!

# 2.2.0
- Adds support for neste fields

# 2.1.0
- Removes the requirement for a search engine version to support the different ways ES handles returning fields

# 2.0.5
- Support simple grouping in Solr

# 1.2.0
- Elasticsearch bulk search support

# 1.1.0
- Search validator to check URL for correct search results

# 1.0.0
- Elasticsearch support

# 0.1.10

## Bug Fixes

- Support for Solr URL's without a protocol

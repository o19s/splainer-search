Version numbers correspond to `package.json` version

# 2.5.8
- Fix rendering logic to handle Arrays and JSON objects so you don't get `"[object Object]"` in the UI. Another great fix by @CgamesPlay!

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

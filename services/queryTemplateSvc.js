'use strict';

angular.module('o19s.splainer-search')
  .service('queryTemplateSvc', function queryTemplateSvc() {
    var self      = this;
    self.hydrate = hydrate;

    var defaultConfig = {
      encodeURI: false,
      defaultKw: '""',
    };

    function encode(queryPart, config) {
      if (config.encodeURI) {
        return encodeURIComponent(queryPart);
      } else {
        return queryPart;
      }
    }

    /**
     * Gets a "descendant" property, traversing the object hierarchy, i.e. desc='a.b.c' will get obj['a']['b']['c']
     * Will return null if any of the traversal steps does not resolve into a value, or return a default value if the
     * last resolve property name declared a default value, i.e. desc='a.b.c|d' will return 'd' if there is no
     * property 'c' on obj['a']['b']
     */
    function getDescendantProp(obj, desc) {
      const arr = desc.split('.').map((s) => s.trim()).filter((s) => s.length > 0);
      while (arr.length && obj !== null) {
        let key = arr.shift();
        let defaultValue = null;
        // special case: key|default denotes a key with a default value, extract that default value
        if (key.indexOf('|') !== -1) {
          [key, defaultValue] = key.split('|');
        } else if (/keyword\d+/g.test(key)) {
          // legacy: support the empty String as a fallback to keywordX placeholders
          defaultValue = '';
        }
        if (Object.keys(obj).indexOf(key) > -1)  {
          obj = obj[key];
        } else {
          obj = defaultValue;
        }
      }
      return obj;
    }

    function extractReplacements(s, parameters) {
      // return the source string and replacement as a map
      const extractionRegex = /#\$([\w.|]+)##/g;
      const replacements = [];
      let match;
      do {
        match = extractionRegex.exec(s);
        if (match !== null) {
          const matchedString = match[0];
          const prop = match[1];
          const replacement = getDescendantProp(parameters, prop);
          // console.log(`Matched ${matchedString}, key ${prop}, replacement: ${replacement}`);
          if (replacement !== null) {
              replacements.push([matchedString, replacement]);
          } else {
              console.log(`No replacement found in options for ${matchedString}`);
          }
        }
      } while (match !== null);
      return replacements;
    }

    /**
     * Replaces #$parameter## values in strings, also supporting #$parameter.x.y...# syntax where x and y are resolved
     * as (sub-)properties of a passed in option values object
     */
    function replaceInString(s, optionValues) {
      const singleTemplateMatchRegex = /^#\$[\w.|]+##$/g;
      const replacements = extractReplacements(s, optionValues);
      if (singleTemplateMatchRegex.test(s)) {
        // special case, full value replacement, used to replace String value placeholders with different types
        // return only the replacement of the first and only matched pattern
        return replacements.length > 0 ? replacements[0][1] : s;
      } else {
        // pattern is embedded into the String (can be multiple times), replace each placeholder occurrence
        let replaced = s;
        replacements.forEach((replacement) => {
          replaced = replaced.replaceAll(replacement[0], replacement[1]);
        });
        return replaced;
      }
    }

    const isObject = (a) => typeof a === 'object' && a !== null;
    const isString = (a) => typeof a === 'string';

    function applyTemplating(o, parameters) {
        if (isString(o)) {
            return replaceInString(o, parameters);
        } else if (Array.isArray(o)) {
            return o.map((entry) => applyTemplating(entry, parameters));
        } else if (isObject(o)) {
            // copy the input to make sure we don't modify the original
            const obj = Object.assign({}, o);
            for (const key of Object.keys(obj)) {
                obj[key] = applyTemplating(obj[key], parameters);
            }
            return obj;
        } else {
            return o;
        }
    }

    function hydrate(template, queryText, config) {
      if (!config) {
        config = defaultConfig;
      }

      if (queryText === null || angular.isUndefined(queryText)) {
        return template;
      }

      const parameters = Object.create(null);
      parameters.query = encode(queryText, config);

      const keywords = queryText.split(/[ ,]+/).map((term) => encode(term.trim(), config));
      parameters.keyword = keywords;
      // legacy: also support #$keyword1## syntax
      keywords.forEach((keyword, idx) => parameters[`keyword${idx + 1}`] = keyword);

      if (config.qOption) {
          parameters.qOption = config.qOption;
      }

      return applyTemplating(template, parameters);
    }

  });

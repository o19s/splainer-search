'use strict';

import URI from 'urijs';

export function esUrlSvcConstructor(customHeadersJson, utilsSvc) {
  var self = this;

  self.parseUrl = parseUrl;
  self.buildDocUrl = buildDocUrl;
  self.buildExplainUrl = buildExplainUrl;
  self.buildUrl = buildUrl;
  self.buildBaseUrl = buildBaseUrl;
  self.buildRenderTemplateUrl = buildRenderTemplateUrl;
  self.setParams = setParams;
  self.getHeaders = getHeaders;
  self.stripBasicAuth = stripBasicAuth;
  self.isBulkCall = isBulkCall;
  self.isTemplateCall = isTemplateCall;

  /**
   *
   * Parses an ES URL of the form [http|https]://[username@password:][host][:port]/[collectionName]/_search
   * Splits up the different parts of the URL.
   *
   */
  function parseUrl(url) {
    url = utilsSvc.ensureUrlHasProtocol(url);
    var a = new URI(url);

    var esUri = {
      protocol: a.protocol(),
      host: a.host(),
      pathname: a.pathname(),
      username: a.username(),
      password: a.password(),
      query: a.query(),
    };

    if (esUri.pathname.endsWith('/')) {
      esUri.pathname = esUri.pathname.substring(0, esUri.pathname.length - 1);
    }

    return esUri;
  }

  /**
   *
   * Builds ES URL of the form [protocol]://[host][:port]/[index]/[type]/[_explain|_doc]/[id]
   * for an ES document.
   *
   */
  function buildDocUrl(uri, doc, addExplain) {
    var index = doc._index;
    var type = doc._type;
    var id = doc._id;

    var url = self.buildBaseUrl(uri);

    url = url + '/' + index + '/';
    if (!addExplain && type) {
      url = url + type + '/';
    }

    if (addExplain) {
      url = url + '_explain';
    } else if (type !== '_doc') {
      url = url + '_doc';
    }

    if (!url.endsWith('/')) {
      url += '/';
    }
    url = url + id.replace(/#/g, '%23');

    if (!addExplain) {
      url = url + '?pretty=true';
    }
    return url;
  }

  /**
   *
   * Builds ES URL of the form [protocol]://[host][:port]/[index]/[type]/_explain/[id]
   * for an ES document.
   *
   */
  function buildExplainUrl(uri, doc) {
    return buildDocUrl(uri, doc, true);
  }

  /**
   *
   * Builds ES URL of the form [protocol]://[host][:port]/_render/template
   * for seeing a rendered template.
   *
   */
  function buildRenderTemplateUrl(uri) {
    var url = self.buildBaseUrl(uri);

    url = url + '/_render/template';

    return url;
  }

  /**
   *
   * Builds ES URL for a search query.
   * Adds any query params if present: /_search?from=10&size=10
   */
  function buildUrl(uri) {
    var self = this;

    var url = self.buildBaseUrl(uri);
    url = url + uri.pathname;

    // Return original URL if no params to append.
    if (uri.params === undefined && uri.query === undefined) {
      return url;
    }

    var paramsAsStrings = [];

    utilsSvc.safeForEach(uri.params, function (value, key) {
      paramsAsStrings.push(key + '=' + value);
    });

    if (uri.query !== undefined && uri.query !== '') {
      paramsAsStrings.push(uri.query);
    }

    // Return original URL if no params to append.
    if (paramsAsStrings.length === 0) {
      return url;
    }

    var finalUrl = url;

    if (finalUrl.substring(finalUrl.length - 1) === '?') {
      finalUrl += paramsAsStrings.join('&');
    } else {
      finalUrl += '?' + paramsAsStrings.join('&');
    }

    return finalUrl;
  }

  function buildBaseUrl(uri) {
    var url = uri.protocol + '://';
    url += uri.host;

    return url;
  }

  function setParams(uri, params) {
    uri.params = params;
  }

  function getHeaders(uri, customHeaders) {
    var headers = {};
    customHeaders = customHeaders || '';

    if (customHeaders.length > 0) {
      var parsed = customHeadersJson.tryParseObject(customHeaders);
      if (parsed.ok) {
        headers = parsed.headers;
      } else if (
        uri.username !== undefined &&
        uri.username !== '' &&
        uri.password !== undefined &&
        uri.password !== ''
      ) {
        headers = { Authorization: 'Basic ' + btoa(uri.username + ':' + uri.password) };
      }
    } else if (
      uri.username !== undefined &&
      uri.username !== '' &&
      uri.password !== undefined &&
      uri.password !== ''
    ) {
      var authorization = 'Basic ' + btoa(uri.username + ':' + uri.password);
      headers = { Authorization: authorization };
    }

    return headers;
  }

  /**
   *
   * Removes any embedded user:password@ from a URL.
   *
   */
  function stripBasicAuth(url) {
    return url.replace(/(:\/\/)([^@]+)@/, '$1');
  }

  function isBulkCall(uri) {
    return uri.pathname.endsWith('_msearch');
  }

  // in the args is an id parameter like "id: 'tmdb-title-search-template'" that specifies a template
  // This let's us understand when to add a /template
  function isTemplateCall(args) {
    if (args && args.id) {
      return true;
    } else {
      return false;
    }
  }
}

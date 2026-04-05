// Karma debug configuration
// http://karma-runner.github.io/6.4/config/configuration-file.html
//
// Run: grunt karma:debug
// Coverage HTML report: coverage/debug/index.html (see coverageReporter below).

'use strict';

var path = require('path');

require('./scripts/karma-chrome-bin');

module.exports = function(config) {
  config.set({
    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,

    // base path, that will be used to resolve files and exclude
    basePath: './',

    // testing framework to use (jasmine/mocha/qunit/...)
    frameworks: ['jasmine'],

    // list of files / patterns to load in the browser
    files: [
      'node_modules/angular/angular.js',
      'node_modules/angular-mocks/angular-mocks.js',
      'node_modules/urijs/src/URI.min.js',
      'services/**/*.js',
      'factories/**/*.js',
      'values/**/*.js',
      'test/mock/**/*.js',
      'test/spec/**/*.js'
    ],

    // list of files / patterns to exclude
    exclude: [],

    // strip-exports removes ESM export keywords; coverage instruments the result.
    preprocessors: {
      'services/**/*.js': ['strip-exports', 'coverage'],
      'factories/**/*.js': ['strip-exports', 'coverage'],
      'values/**/*.js': ['strip-exports', 'coverage']
    },

    // web server port
    port: 8080,

    browsers: [
      'ChromeHeadlessNoSandbox'
    ],

    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--headless']
      }
    },

    // Which plugins to enable
    plugins: [
      'karma-chrome-launcher',
      'karma-coverage',
      require('./scripts/karma-strip-exports.cjs'),
      'karma-jasmine'
    ],

    reporters: ['progress', 'coverage'],

    coverageReporter: {
      dir: path.join(__dirname, 'coverage'),
      subdir: 'debug',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },

    singleRun: false,

    colors: true,

    // level of logging
    // possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
    logLevel: config.LOG_INFO,

    // Uncomment the following lines if you are using grunt's server to run the tests
    // proxies: {
    //   '/': 'http://localhost:9000/'
    // },
    // URL root prevent conflicts with the site root
    // urlRoot: '_karma_'
  });
};

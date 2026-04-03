// Karma configuration for code coverage
require('./scripts/karma-chrome-bin');

module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    files: [
      'node_modules/angular/angular.js',
      'node_modules/angular-mocks/angular-mocks.js',
      'node_modules/urijs/src/URI.min.js',
      'module.js',
      'services/**/*.js',
      'factories/**/*.js',
      'values/**/*.js',
      'test/mock/**/*.js',
      'test/spec/**/*.js'
    ],
    exclude: [],
    preprocessors: {
      'services/**/*.js': ['coverage'],
      'factories/**/*.js': ['coverage'],
      'values/**/*.js': ['coverage']
    },
    reporters: ['progress', 'coverage'],
    coverageReporter: {
      dir: 'coverage/',
      reporters: [
        { type: 'text' },
        { type: 'text-summary' },
        { type: 'html', subdir: 'html' }
      ]
    },
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox']
      }
    },
    singleRun: true,
    concurrency: Infinity
  });
};

// Karma configuration for code coverage. `.cjs` marks explicit CommonJS (Karma loads via require);
// a plain `.js` file in this package triggers “convert to ES module” tooling hints that do not apply here.
require('./scripts/karma-chrome-bin');

module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      'karma-jasmine',
      'karma-chrome-launcher',
      'karma-coverage',
      require('./scripts/karma-strip-exports.cjs'),
    ],
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
    exclude: [],
    // strip-exports removes ESM export syntax before coverage instruments them.
    preprocessors: {
      'services/**/*.js': ['strip-exports', 'coverage'],
      'factories/**/*.js': ['strip-exports', 'coverage'],
      'values/**/*.js': ['strip-exports', 'coverage']
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

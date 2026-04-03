/**
@toc
2. load grunt plugins
3. init
4. setup variables
5. grunt.initConfig
6. register grunt tasks

Named Gruntfile.cjs so Node and TypeScript treat it as CommonJS (Grunt’s API) and do not suggest
converting module.exports to ESM.

*/

'use strict';

module.exports = function (grunt) {
  /**
	Load grunt plugins
	@toc 2.
	*/
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-karma');
  /**
	Function that wraps everything to allow dynamically setting/changing grunt options and config later by grunt task. This init function is called once immediately (for using the default grunt options, config, and setup) and then may be called again AFTER updating grunt (command line) options.
	@toc 3.
	@method init
	*/
  function init(_params) {
    /**
		Project configuration.
		@toc 5.
		*/
    grunt.initConfig({
      eslint: {
        options: {
          useEslintrc: true,
          fix: false,
        },
        target: ['module.js', 'services/*.js', 'factories/*.js', 'values/*.js'],
      },
      concat: {
        dist: {
          src: ['module.js', 'services/*.js', 'factories/*.js', 'values/*.js'],
          dest: 'splainer-search.js',
        },
      },
      karma: {
        unit: {
          configFile: 'karma.conf.js',
          singleRun: true,
        },
        coverage: {
          configFile: 'karma.coverage.conf.cjs',
          singleRun: true,
        },
        debug: {
          configFile: 'karma.debug.conf.js',
          singleRun: false,
          autoWatch: true,
        },
      },
    });

    /**
		register/define grunt tasks
		@toc 6.
		*/
    // Default task(s).
    grunt.registerTask('default', ['eslint', 'karma:unit', 'concat:dist']);

    grunt.registerTask('build', ['concat:dist']);
  }
  init({}); //initialize here for defaults (init may be called again later within a task)
};

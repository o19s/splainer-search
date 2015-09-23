/**
@toc
2. load grunt plugins
3. init
4. setup variables
5. grunt.initConfig
6. register grunt tasks

*/

'use strict';

module.exports = function(grunt) {

	/**
	Load grunt plugins
	@toc 2.
	*/
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-karma');
	/**
	Function that wraps everything to allow dynamically setting/changing grunt options and config later by grunt task. This init function is called once immediately (for using the default grunt options, config, and setup) and then may be called again AFTER updating grunt (command line) options.
	@toc 3.
	@method init
	*/
	function init(params) {
		/**
		Project configuration.
		@toc 5.
		*/
		grunt.initConfig({
			jshint: {
        options: {
          force:	true,
          ignores: ['**.min.js'],
          jshintrc: '.jshintrc'
        },
        all: {
          src: ['module.js', 'services/*.js', 'factories/*.js', 'values/*.js']
        }
      },
      concat: {
        dist: {
					src:    ['module.js', 'services/*.js', 'factories/*.js', 'values/*.js'],
					dest:   'splainer-search.js'
        }
      },
			uglify: {
				options: {
					mangle: false
				},
				build: {
					files:  {},
					src:    ['module.js', 'services/*.js', 'factories/*.js', 'values/*.js'],
					dest:   'splainer-search.min.js'
				}
			},
			karma: {
				unit: {
					configFile: 'karma.conf.js',
					singleRun: true,
					browsers: ['PhantomJS']
				},
				debug: {
					configFile: 'karma.debug.conf.js',
					singleRun: false,
          autoWatch: true
				}
			}
		});


		/**
		register/define grunt tasks
		@toc 6.
		*/
		// Default task(s).
		grunt.registerTask('default', ['jshint', 'karma:unit', 'concat:dist']);

	}
	init({});		//initialize here for defaults (init may be called again later within a task)

};

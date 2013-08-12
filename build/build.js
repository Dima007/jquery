/**
 * Special concat/build task to handle various jQuery build requirements
 * Concats AMD modules, removes their definitions, and includes/excludes specified modules
 */

module.exports = function( grunt ) {

	var requirejs = require("requirejs"),
		config = {
			baseUrl: "src",
			name: "jquery",
			out: "dist/jquery.js",
			// We have multiple minify steps
			optimize: "none",
			wrap: {
				startFile: "src/intro.js",
				endFile: "src/outro.js"
			},
			rawText: {
				"var/arr": "var arr = [];"
			}
		};

	grunt.registerMultiTask(
		"build",
		"Concatenate source, remove sub AMD definitions, (include/exclude modules with +/- flags), embed date/version",
		function() {

			var flag,
				done = this.async(),
				compiled = "",
				flags = this.flags,
				optIn = !flags["*"],
				explicit = optIn || Object.keys(flags).length > 1,
				name = this.data.dest,
				src = this.data.src,
				minimum = this.data.minimum,
				deps = {},
				excluded = [],
				included = [],
				version = grunt.config( "pkg.version" ),
				excluder = function( flag ) {
					var m = /^(\+|\-|)(\w+)$/.exec( flag ),
						exclude = m[1] === "-",
						module = m[2];

					// Can't exclude certain modules
					if ( exclude ) {
						if ( minimum.indexOf( module ) === -1 ) {
							excluded.push( module );
						} else {
							grunt.log.error( "Module \"" + module + "\" is a mimimum requirement.");
						}
					} else {
						included.push( module );
					}
				};

			// append commit id to version
			if ( process.env.COMMIT ) {
				version += " " + process.env.COMMIT;
			}

			// figure out which files to exclude based on these rules in this order:
			//  dependency explicit exclude
			//  > explicit exclude
			//  > explicit include
			//  > dependency implicit exclude
			//  > implicit exclude
			// examples:
			//  *                  none (implicit exclude)
			//  *:*                all (implicit include)
			//  *:*:-css           all except css and dependents (explicit > implicit)
			//  *:*:-css:+effects  same (excludes effects because explicit include is trumped by explicit exclude of dependency)
			//  *:+effects         none except effects and its dependencies (explicit include trumps implicit exclude of dependency)
			for ( flag in flags ) {
				if ( flag !== "*" ) {
					excluder( flag );
				}
			}
			grunt.verbose.writeflags( excluded, "Excluded" );
			grunt.verbose.writeflags( included, "Included" );

			// append excluded modules to version
			if ( excluded.length ) {
				version += " -" + excluded.join( ",-" );
				// set pkg.version to version with excludes, so minified file picks it up
				grunt.config.set( "pkg.version", version );
				grunt.verbose.writeln( "Version changed to " + version );
				config.include = included;
				config.exclude = excluded;
			}

			// Trace dependencies and concatenate files
			requirejs.optimize( config, function( response ) {
				grunt.verbose.writeln( response );
				grunt.log.ok( "Files concatenated" );
				done();
			}, function( err ) {
				done( err );
			});

			return;

			// conditionally concatenate source
			// src.forEach(function( filepath ) {
			// 	var flag = filepath.flag,
			// 			specified = false,
			// 			omit = false,
			// 			messages = [];

			// 	if ( flag ) {
			// 		if ( excluded[ flag ] !== undefined ) {
			// 			messages.push([
			// 				( "Excluding " + flag ).red,
			// 				( "(" + filepath.src + ")" ).grey
			// 			]);
			// 			specified = true;
			// 			omit = !filepath.alt;
			// 			if ( !omit ) {
			// 				flag += " alternate";
			// 				filepath.src = filepath.alt;
			// 			}
			// 		}
			// 		if ( excluded[ flag ] === undefined ) {
			// 			messages.push([
			// 				( "Including " + flag ).green,
			// 				( "(" + filepath.src + ")" ).grey
			// 			]);

			// 			// If this module was actually specified by the
			// 			// builder, then set the flag to include it in the
			// 			// output list
			// 			if ( flags[ "+" + flag ] ) {
			// 				specified = true;
			// 			}
			// 		}

			// 		filepath = filepath.src;

			// 		// Only display the inclusion/exclusion list when handling
			// 		// an explicit list.
			// 		//
			// 		// Additionally, only display modules that have been specified
			// 		// by the user
			// 		if ( explicit && specified ) {
			// 			messages.forEach(function( message ) {
			// 				grunt.log.writetableln( [ 27, 30 ], message );
			// 			});
			// 		}
			// 	}

			// 	if ( !omit ) {
			// 		compiled += grunt.file.read( filepath );
			// 	}
			// });

			// Embed Version
			// Embed Date
			compiled = compiled.replace( /@VERSION/g, version )
				// yyyy-mm-ddThh:mmZ
				.replace( /@DATE/g, ( new Date() ).toISOString().replace( /:\d+\.\d+Z$/, "Z" ) );

			// Write concatenated source to file
			grunt.file.write( name, compiled );

			// Fail task if errors were logged.
			if ( this.errorCount ) {
				return false;
			}

			// Otherwise, print a success message.
			grunt.log.writeln( "File '" + name + "' created." );
		});
};

module.exports = function(grunt) {

  grunt.initConfig({
  	cssmin : {
  		"css" : {
  			options : {
					keepSpecialComments : 0
  			},
				files: {
					'public/static/build/css/build.css' : [
					'public/static/css/bip.css'
					]
				}
  		},
  		"css-wl" : {
  			options : {
					keepSpecialComments : 0
  			},
				files: {
					'public/static/build/css/build-wl.css' : [
					'public/static/css/bip.css'
					]
				}
  		},
  		"css-share-widget" : {
  			options : {
					keepSpecialComments : 0
  			},
				files: {
					'public/static/build/css/share-widget.css' : [
					'public/static/css/share-widget.css'
					]
				}
  		}
  	},
  	requirejs : {
  		dash : {
  			options : {
				  "baseUrl" : "public/static/js",
				  "name": "dash-main",

				  "exclude": [],
				  "optimize": "uglify2", // this is 'none' for dependency injection. do not remove.

				  "out": "./public/static/build/js/dash-built.js",

			    paths: {
			        jquery: 'vendor/jquery/jquery-min',
			        jquery_b64 : 'vendor/jquery/jquery.base64.min',
			        bootstrap : 'vendor/bootstrap/bootstrap-bundle',
			        'bootstrap.templar' : 'vendor/bootstrap/bootstrap-templar',
			        moment : 'vendor/moment.min',
			        momenttz : 'vendor/moment-timezone.min',
			        underscore: 'vendor/underscore/underscore-1.8.1',
			        backbone: 'vendor/backbone/backbone-min',
			        sessionstorage: "vendor/backbone/backbone.sessionStorage",
			        'backbone.validator' : 'vendor/backbone/backbone-validation-amd-min',
			        'd3' : 'vendor/d3/d3.min',
			        'select2' : 'vendor/select2',
			        'templar2' : 'vendor/templar2',
			        bipclient: 'client',
			        medium : 'vendor/medium-editor',
			        redactor : 'vendor/redactor/redactor',
			        fuelux : 'vendor/fuelux',
			        c_domain : 'collections/domain/c_domain_all',
			        c_channel : 'collections/channel/c_channel_all',
			        c_channel_bip_list : 'collections/channel/c_channel_bip_list',
			        c_mount_local : 'collections/mount/c_mount_local',
			        c_bip : 'collections/bip/c_bip_all',
			        c_bip_desc : 'collections/bip/c_bip_descriptions',
			        c_bip_share : 'collections/bip/c_bip_share',
			        c_bip_log : 'collections/bip/c_bip_log',
			        c_channel_log : 'collections/channel/c_channel_log',
			        c_pod : 'collections/channel/c_pod_all',
			        wotadmin_hub: 'vendor/wotadmin-hub'
			    },

			    priority : [
			      'jquery',
			      'jquery_b64',
			      'bootstrap',
			      'moment'
			    ],
			    shim : {
			        "backbone": {
			            deps: ["underscore", "jquery"],
			            exports: "Backbone"
			        },
			        'bootstrap': [ 'jquery' ],
			        'backbone.validator' : {
			            deps : [ 'backbone' ]
			        },
			        "d3" : {
			            exports : "d3"
			        },
			        'bipclient' : {
			            exports : 'BipClient'
			        },
			        "jquery_b64" : {
			            deps : [ "jquery" ]
			        },
			        "moment" : {
			          exports : 'moment',
			          deps : [ "jquery" ]
			        },
			        "redactor" : {
			          deps : [ "jquery" ]
			        },
			        "select2" : {
			          deps : [ "jquery" ]
			        },
			        "templar" : {
			          deps : [ "jquery" ]
			        },
			        "wotadmin_hub" : {
			          exports: [ "WotAdmin_Hub" ]
			        }
			    },
			    preserveLicenseComments : false,
			    generateSourceMaps : true
				}
			},
			"account" : {
				options : {
				  baseUrl : "public/static/js",
				  "name": "account-main",
				  "out": "./public/static/build/js/account-built.js",
//			    uglify : "none",
				  paths: {
				    jquery: 'vendor/jquery/jquery-min',
				    jquery_b64 : 'vendor/jquery/jquery.base64.min',
				    bootstrap : 'vendor/bootstrap/bootstrap-bundle',
				    underscore: 'vendor/underscore/underscore-1.8.1',
				    backbone: 'vendor/backbone/backbone-min',
				    sessionstorage: "vendor/backbone/backbone.sessionStorage",
				    bipclient: 'client',
				    c_domain : 'collections/domain/c_domain_all',
				    c_channel : 'collections/channel/c_channel_all',
				    c_channel_pod : 'collections/channel/c_pod_all',
				    c_mount_local : 'collections/mount/c_mount_local',
				    c_pod : 'collections/channel/c_pod_all',
				    'd3' : 'vendor/d3/d3.min',
		        'select2' : 'vendor/select2',
				  },
				  shim : {
				    "backbone": {
				      deps: ["underscore", "jquery"],
				      exports: "Backbone"  //attaches "Backbone" to the window object
				    },
				    'bootstrap': [ 'jquery' ],
				    "d3" : {
				      exports : "d3"
				    },
		        "select2" : {
		          deps : [ "jquery" ]
		        },
				    "jquery_b64" : {
				      deps : [ "jquery" ]
				    }
				  },
			    preserveLicenseComments : false
				}
			},
			"index" : {
				options : {
				  baseUrl : "public/static/js",
				  "name": "index-main",
				  "out": "./public/static/build/js/index-built.js",
					paths: {
				    'signup_inline' : 'signup/v_signup_inline',
				    'sign_inline' : 'signin/v_sign_inline',
				    jquery: 'vendor/jquery/jquery-min',
				    jquery_b64 : 'vendor/jquery/jquery.base64.min',
				    'bootstrap' : 'vendor/bootstrap/bootstrap-bundle',
				    underscore: 'vendor/underscore/underscore-1.8.1',
				    backbone : 'vendor/backbone/backbone-min',
				    c_mount_local : 'collections/mount/c_mount_local',
				    bipclient: 'client',
				    sessionstorage: "vendor/backbone/backbone.sessionStorage",
				    particles : "views/v_particle",
		        'share_svg': 'apps/community/views/v_share_svg',
				    'd3' : 'vendor/d3/d3.min'
				  },
				  shim : {
				    'bootstrap': [ 'jquery' ],
				    "jquery_b64" : {
				      deps : [ "jquery" ]
				    }
				  },
			    preserveLicenseComments : false
				}
			},
			"index-shipiot" : {
				options : {
				  baseUrl : "public/static/js",
				  "name": "index-main-shipiot",
				  "out": "./public/static/build/js/index-shipiot-built.js",
					paths: {
				    'signup_inline' : 'signup/v_signup_inline',
				    'sign_inline' : 'signin/v_sign_inline',
				    jquery: 'vendor/jquery/jquery-min',
				    jquery_b64 : 'vendor/jquery/jquery.base64.min',
				    'bootstrap' : 'vendor/bootstrap/bootstrap-bundle',
				    underscore: 'vendor/underscore/underscore-1.8.1',
				    backbone : 'vendor/backbone/backbone-min',
				    c_mount_local : 'collections/mount/c_mount_local',
				    bipclient: 'client',
				    sessionstorage: "vendor/backbone/backbone.sessionStorage",
				    particles : "views/v_particle",
		        'share_svg': 'apps/community/views/v_share_svg',
				    'd3' : 'vendor/d3/d3.min'
				  },
				  shim : {
				    'bootstrap': [ 'jquery' ],
				    "jquery_b64" : {
				      deps : [ "jquery" ]
				    }
				  },
			    preserveLicenseComments : false
				}
			},
			"share" : {
				options : {
				  baseUrl : "public/static/js",
				  "name": "share-main",
				  "out": "./public/static/build/js/share-built.js",
					paths: {
				    'signup_inline' : 'signup/v_signup_inline',
				    'sign_inline' : 'signin/v_sign_inline',
				    jquery: 'vendor/jquery/jquery-min',
				    jquery_b64 : 'vendor/jquery/jquery.base64.min',
				    'bootstrap' : 'vendor/bootstrap/bootstrap-bundle',
				    underscore: 'vendor/underscore/underscore-1.8.1',
				    backbone : 'vendor/backbone/backbone-min',
				    bipclient: 'client',
				    c_mount_local : 'collections/mount/c_mount_local',
				    sessionstorage: "vendor/backbone/backbone.sessionStorage",
		        'share_svg': 'apps/community/views/v_share_svg',
				    'd3' : 'vendor/d3/d3.min'
				  },
				  shim : {
				    'bootstrap': [ 'jquery' ],
				    "d3" : {
				      exports : "d3"
				    },
				    "jquery_b64" : {
				      deps : [ "jquery" ]
				    }
				  },
			    preserveLicenseComments : false
				}
			},
			"profile" : {
				options : {
				  baseUrl : "public/static/js",
				  "name": "profile-main",
				  "out": "./public/static/build/js/profile-built.js",
					paths: {
				    'signup_inline' : 'signup/v_signup_inline',
				    'sign_inline' : 'signin/v_sign_inline',
				    jquery: 'vendor/jquery/jquery-min',
				    jquery_b64 : 'vendor/jquery/jquery.base64.min',
				    'bootstrap' : 'vendor/bootstrap/bootstrap-bundle',
				    underscore: 'vendor/underscore/underscore-1.8.1',
				    backbone : 'vendor/backbone/backbone-min',
				    bipclient: 'client',
				    c_mount_local : 'collections/mount/c_mount_local',
				    sessionstorage: "vendor/backbone/backbone.sessionStorage",
		        'share_svg': 'apps/community/views/v_share_svg',
				    'd3' : 'vendor/d3/d3.min'
				  },
				  shim : {
				    'bootstrap': [ 'jquery' ],
				    "d3" : {
				      exports : "d3"
				    },
				    "jquery_b64" : {
				      deps : [ "jquery" ]
				    }
				  },
			    preserveLicenseComments : false
				}
			},
			"pricing" : {
				options : {
				  baseUrl : "public/static/js",
				  "name": "pricing-main",
				  "out": "./public/static/build/js/pricing-built.js",
					paths: {
				    'signup_inline' : 'signup/v_signup_inline',
				    'sign_inline' : 'signin/v_sign_inline',
				    jquery: 'vendor/jquery/jquery-min',
				    jquery_b64 : 'vendor/jquery/jquery.base64.min',
				    'bootstrap' : 'vendor/bootstrap/bootstrap-bundle',
				    underscore: 'vendor/underscore/underscore-1.8.1',
				    backbone : 'vendor/backbone/backbone-min',
				    bipclient: 'client',
				    c_mount_local : 'collections/mount/c_mount_local',
				    sessionstorage: "vendor/backbone/backbone.sessionStorage"
				  },
				  shim : {
				    'bootstrap': [ 'jquery' ],
				    "jquery_b64" : {
				      deps : [ "jquery" ]
				    }
				  },
			    preserveLicenseComments : false
				}
			}
  	},
  	replace: {
	    build : {
        options: {
		      patterns: [
		        {
		          match: 'timestamp',
		          replacement: '<%= new Date().getTime() %>'
		        }
		      ]
		    },
		    files: [
		      {
		      	expand: true,
		      	flatten: true,
		      	src: [ 'application/layouts/scripts/default.phtml'],
		      	dest: 'application/layouts/scripts/build/'
		      },
		      {
		      	expand: true,
		      	flatten: true,
		      	src: [ 'application/layouts/scripts/default_wl.phtml'],
		      	dest: 'application/layouts/scripts/build/'
		      },
		      {
			      	expand: true,
			      	flatten: true,
			      	src: [ 'application/layouts/scripts/shipiot.phtml'],
			      	dest: 'application/layouts/scripts/build/'
			   },
		      {
		      	expand: true,
		      	flatten: true,
		      	src: [ 'application/layouts/scripts/widget.phtml'],
		      	dest: 'application/layouts/scripts/build/'
		      },
		      {
		      	expand: true,
		      	flatten: true,
		      	src: [ 'application/layouts/scripts/share.phtml'],
		      	dest: 'application/layouts/scripts/build/'
		      }
		    ]
	    }
		},
		less : {
			default : {
				files : {
					"public/static/css/bip.css" : "public/static/less/bip.less"
				}
			},
			share_widget : {
				files : {
					"public/static/css/share-widget.css" : "public/static/less/shares.less"
				}
			}
		},
		uglify : {
			/*
			options : {
				compress : true,
				mangle : {
					except : [
						'$',
		        'OutboxModule',
		        'BipModule',
		        'BipCommunityView',
		        'PodsModuleView',
		        'UIModuleView'
		      ]
				}
			},
			dash_built : {
				files : {
					'public/static/build/js/dash-built-out.js' : [ 'public/static/build/js/dash-built.js']
				}
			},
			*/
			share_widget : {
				files : {
					'public/static/build/js/widget-loader.js' : [ 'public/static/js/widget-loader.js']
				}
			}
		},
		clean: [
			"application/layouts/scripts/build",
			"public/static/build"
		]
  });

  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-replace');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-clean');

  grunt.registerTask('default', ['clean', 'less', 'cssmin', 'requirejs', 'replace', 'uglify']);
}
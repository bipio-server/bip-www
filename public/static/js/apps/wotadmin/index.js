/**
 *
 * BipIO graphs app
 *
 */
define([
  'underscore',
  'backbone',
  'bipclient',
  'wotadmin_hub',
  'apps/wotadmin/views/v_wotadmin_modal'
  ], function(_, Backbone, BipClient, WotAdmin_Hub, WotModal) {

	var admin_hub = {};

	var retryFactor = 0;
	var retryTimeout = null;

	socketOpenedTime = null;
	socketClosedTime = null;

  var readyCallback,
    closeCallback;

	var openSocket = function() {
		if(BipClient._auth.ws_host && !admin_hub.isOpen()) {
			var loginfo = ['loggedin',
			               BipClient._auth.ws_host.split(".")[1],
			               BipClient._auth.token_username,
			               BipClient._auth.auth_token
			               ];
//			console.log("BipIo Messaging Hub to Open a Socket Connection");
			window.addEventListener("message", handleBipClientLogging, false);
			window.postMessage(JSON.stringify(loginfo),"*");
		}
	};

	var handleBipClientLogging = function(message) {
		if(message.origin == window.location.origin) {
//			console.log("Bip Client listening on Message");
			var msg = null;
			try {
				msg = JSON.parse(message.data);
			} catch(e) {
				msg = message.data;
			}
			if(msg instanceof Array) {
				if(msg[0] == "client_loaded") {
//					console.log("BipIo instantiating a wotadmin hub");
					var md = new WotModal({});
					admin_hub = new WotAdmin_Hub(md, (((BipClient._params.proto == "https") ? "wss://" : "ws://") + BipClient._auth.ws_host), BipClient._params.ifexe_version);
					//md.renderModal()
					openSocket();
				} if(msg[0] == "socket_opened") {
					socketOpenedTime = Date.now();
//					console.log("Date open: "+ socketOpenedTime)
					//Reopen the socket whenever it gets closed
					admin_hub.socket.addEventListener("close", reopenSocket, false);
					cleanupLoginListener()
				} if(msg[0] == "socket_closed") {
					//Reopen the socket whenever it gets closed
					admin_hub.socket.addEventListener("close", reopenSocket, false);
				}
			}
		}
	}

  var closeQueue;


	var reopenSocket = function(event) {
		//console.log(event)
		socketClosedTime = Date.now();
		//console.log("Date closed: "+ socketClosedTime + "\n Retry Count: " + retryFactor +"\n Open close time ellapsed: "+ (socketClosedTime - socketOpenedTime));
		var socketUpTime = socketClosedTime - socketOpenedTime;

    // we don't have a way of detecting 403's
    // so assuming that shortly lived connections are token errors
    // and dropping the app
    if (socketUpTime < 10000) {
      if (closeQueue) {
        clearTimeout(closeQueue);
      }

      closeQueue = setTimeout(function() {
        if (closeCallback) {
          closeCallback();
        }
      }, 1000);

		} else if (socketUpTime < 60000) { //If socket is up for less then a minute (its much less, on socket connection error it opens than closes for less the 179 millisec
//			retryFactor++;
//			console.log("Schedule Socket to open in "+ retryFactor +" minutes from now: "+Date.now())
//			retryTimeout = setTimeout(openSocket, 60000 * retryFactor);


		} else {
			console.log("Tryin to reopen socket immediately: "+Date.now())
			openSocket();
			retryFactor = 0;
		}
	}

	var setupLogingListener = function () {
		window.addEventListener("message", handleBipClientLogging, false);
	}

	var cleanupLoginListener = function () {
		window.removeEventListener('message', handleBipClientLogging, false);
	}

	//Listen for login
	setupLogingListener();


    var WotModuleView = Backbone.View.extend({
      el: '#wotadmin-container', // render widget to this container
      appID : 'wotadmin', // identify bips created with this app

      container : null,
      router : null,

      obView : null,

      initialize : function() {
        var self = this;
        _.bindAll(
          this,
          'render'
        );

        console.log("in initialize: ", BipClient)
       },

      shutdown : function() {
      },

      // renders the app container
      render : function(frame) {
        var adminFrames = {
            'users' : {
              title : 'Users',
              frames : [
                {
                  src : 'users/user_list',
                  minHeight : 400,
                  maxHeight : 800
                },
                {
                  src : 'users/user_details',
                  minHeight : 400,
                  maxHeight : 800
                },
                {
                  src : 'users/user_group_list',
                  minHeight : 400,
                  maxHeight : 800
                },
              ]
            },
            'reset-password' : {
              title : 'Reset Password',
              frames : [
                {
                  src : 'resetPassword/reset_password_widget',
                  minHeight : 500,
                  height : 500
                }
              ]
            },
            'groups' : {
              title : 'Groups',
              frames : [
                {
                  src : 'groups/group_list',
                  minHeight : 400,
                  height : 400
                },
                {
                  src : 'groups/member_list',
                  minHeight : 400,
                  height : 400
                },
                {
                  src : 'groups/token_list',
                  minHeight : 500,
                  height : 500
                }
              ]
            },
            'permissions' : {
              title : 'Permissions',
              frames : [
                {
                  src : 'permissions/permission_list',
                  minHeight : 400,
                  height : 400
                }
              ]
            },
            'mounts' : {
              title : 'Mounts',
              frames : [
                {
                  src : 'mounts/mount_list',
                  minHeight : 800,
                  height : 800
                },
                {
                  src : 'mounts/mount_details',
                  minHeight : 800,
                  height : 800
                }
              ]
            },
            'notifications' : {
              title : 'Notifications',
              frames : [
                {
                  src : 'notifications/notification_form',
                  minHeight : 560,
                  height : 560
                },
                {
                  src : 'notifications/notifications_list',
                  minHeight : 400,
                  height : 400
                }
              ]
            },
            'servers' : {
              title : 'Servers',
              frames : [
                {
                  src : 'servers/server_list',
                  minHeight : 400,
                  height : 400
                },
                {
                  src : 'servers/server_details',
                  minHeight : 400,
                  height : 400
                },
                {
                  src : 'servers/server_configuration',
                  minHeight : 400,
                  height : 400
                }
              ]
            },
            'services' : {
              title : 'Services',
              frames : [
                {
                  src : 'services/services_list',
                  minHeight : 400,
                  height : 400
                },
                {
                  src : 'services/services_details',
                  minHeight : 400,
                  height : 400
                },
                {
                  src : 'services/services_servers',
                  minHeight : 400,
                  height : 400
                },
                {
                  src : 'services/service_update',
                  minHeight : 400,
                  height : 400
                }
              ]
            },
            'dataUsage' : {
              title : 'Monitoring',
              frames : [
                {
                  src : 'dataUsage/dataUsageForm',
                  minHeight : 650,
                  height : 650
                },
                {
                  src : 'dataUsage/chart.html?render=connections',
                  minHeight : 500,
                  height : 500
                },
                {
                  src : 'dataUsage/chart.html?render=bytes_read',
                  minHeight : 500,
                  height : 500
                },
                {
                  src : 'dataUsage/chart.html?render=bytes_written',
                  minHeight : 500,
                  height : 500
                }
              ]
            },
            'messages' : {
              title : 'Publish/Consume',
              frames : [
                {
                  src : 'messages/publish_message',
                  span : 5,
                  minHeight : 600,
                  height : 600,
                  maxHeight: 600
                },
                {
                  src : 'messages/consume_message',
                  span : 7,
                  minHeight : 600,
                  height : 600,
                  maxHeight: 600
                }
              ]
            },
            'regex' : {
              title : 'Regex Validate',
              frames : [
                {
                  src : 'regex/regex_bus',
                  minHeight : 400,
                  height : 400
                },
                {
                  src : 'regex/regex_write',
                  minHeight : 400,
                  height : 400
                }
              ]
            }
          },
          self = this,
          tplHTML = _.template($('#tpl-layouts-' + this.appID).html());
          base = BipClient._params.proto + "://" + BipClient._auth.ws_host.split(":")[0] + "/" + BipClient._auth.ws_host.split(".")[1] +"/"

        _.each(adminFrames, function(tab, name) {
          _.each(tab.frames, function(frame) {
            frame.id = frame.src.replace(/\.*$/, '');
            if (-1 === frame.src.indexOf('.html')) {
              frame.src += '.html';
            }
            frame.src = base + frame.src + (-1 === frame.src.indexOf('?') ? '?' : '&') + 'wotio-widget=' + frame.id;
          });
        });

        this.container.html(tplHTML({ adminFrames : adminFrames }));

        $('#wotadmin-tabs a')
          .click(function (e) {
            e.preventDefault();
            $(this).tab('show');
          })
          .tab()
          .on('shown', function(ev) {
            var $frames = $($(this).attr('href') + ' iframe');

            // lazy load frames
            _.each($frames, function(frame) {
              var $frame = $(frame);
              if (!$frame.attr('src')) {
                $frame.attr('src', $frame.attr('data-src'));
              }
            });
          });
      },

      appInfo : function(router, container) {
        var self = this,
          info = {
            name : this.appID,
            title : 'Admin',
            ready : function(next) {
              // master route (router gobbles scope)
              if (BipClient._auth.ws_host) {

                router.route(self.appID, self.appID, function() {
                  self.render.apply(self, arguments);
                });

                router.route(self.appID + '/:frame', self.appID, function(frame) {
                  self.render(frame);
                });
                // ready!
                next();
              } else if (closeCallback) {
                closeCallback();
              }

            },
            close : function(next) {
              closeCallback = next;
            }
          };

        this.container = container;
        this.router = router;

        return info;
      }
    });

    return WotModuleView;
  });

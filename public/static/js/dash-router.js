define([
  'underscore',
  'backbone',

  'bipclient',

  // include apps
  'apps/outbox/index',
  'apps/bipio/index',
  'apps/community/index',
  'apps/pods/index',
  'apps/wotadmin/index',
  'apps/ui/index',
  'apps/stats/index',
  'apps/logs/index'

  ], function(
    _,
    Backbone,
    BipClient,

    // apps - need to be enabled in application.ini > ui.modules string
    OutboxModule,
    BipModule,
    BipCommunityView,
    PodsModuleView,
    WotAdminView,
    UIModuleView,
    StatsModuleView,
    LogsModuleView
    ) {

    // nasty hack to get around
    // uglification, as uglify2 mangle exceptions
    // no longer look to be working
    var moduleEnumerates = [
        'OutboxModule',
        'BipModule',
        'BipCommunityView',
        'PodsModuleView',
        'WotAdminView',
        'UIModuleView',
        'StatsModuleView',
        'LogsModuleView'
      ],
      moduleOffset = 3;

    var routerArgs = arguments;

    var routes = {
      '*actions': 'defaultRoute'
    };

    var modules = [],
      routerArgPtrs = BipClient.getParamNames(routerArgs.callee);

    _.each(UIModules.split(','), function(moduleName) {
      var modIdx = routerArgPtrs.indexOf(moduleName);
      if (-1 !== modIdx) {
        modules.push(routerArgs[modIdx]);

      } else if (-1 !== moduleEnumerates.indexOf(moduleName) ) {
        modules.push(routerArgs[moduleOffset + moduleEnumerates.indexOf(moduleName)]);
      }
    });

    var allowNavigation=false;
    var AppRouter = Backbone.Router.extend({
      routes: routes,
      before: function () {
      },
      after: function () {
      },
      hashChange : function(evt) {
        var oldIsBipioEdit = /bipio\/(new|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.test(evt.originalEvent.oldURL),
          newIsBipio = (-1 !== evt.originalEvent.newURL.indexOf('bipio')),
          shared = -1 !== evt.originalEvent.oldURL.indexOf('shared');

        if ( oldIsBipioEdit && !newIsBipio && !shared && allowNavigation == false ) {

          var self = this;

          evt.stopImmediatePropagation();
          self.cancelNavigate = true;

          var newUrl = evt.originalEvent.newURL;

          window.history.pushState('', '', evt.originalEvent.oldURL);

          BipClient.confirmNavModal({
            cb: function(ev) {
              ev.preventDefault();
              allowNavigation = true;
              this.close();
              app_router.navigate(newUrl.substring(newUrl.indexOf("#")), { trigger : true });
            }
          });

        } else{
          allowNavigation = false;
        }
      },
      beforeUnload : function(evt) {
      },

      allowNavigationFlag:function(){
        allowNavigation = true;
      }
    });

    var containerWidth = $('#page-body .container').width();
    var appContent = $('#app-content');
    var markAction = function(action) {
      $("[id^=init-]").removeClass('active');
      $('#init-' + action).addClass('active');
    }

    var app_router,
      currentView,
      containerWidth = $('#page-body .container').width(),
      appContent = $('#app-content');

    function enableModule(modInfo) {
      var name = modInfo.name;
      $('#app-links ul').append(
        '<li id="init-' + name + '">'
        + '<a href="#' + name + '">' + modInfo.title + '</a>'
        + '</li>'
      );
    }

    function disableModule(modInfo) {
      var name = modInfo.name;
      $('#init-' + name).remove();
    }

    var initialize = function() {
      $('#loader-wrapper').fadeOut(function() {
        $(this).remove();
      });

      app_router = new AppRouter;
      $(window).on("hashchange", app_router.hashChange);
      $(window).on("beforeunload", app_router.beforeUnload);

      app_router.on('route', function(name, args) {
        if ('defaultRoute' !== name) {
          markAction(name);
        }
      })

      _.each(modules, function(mod) {
        var modInfo;
        if (mod.prototype.appInfo) {
          modInfo = mod.prototype.appInfo(app_router, $('#app-content'));

          modInfo.ready((function(modInfo) {
            return function() {
              enableModule(modInfo);
            }
          })(modInfo));

          if (modInfo.close) {
            modInfo.close((function(modInfo) {
              return function() {
                disableModule(modInfo);
              }
            })(modInfo));
          }

          if (modInfo.shutdown) {
            var sdHandler = function(name, args) {
              if (name !== modInfo.name) {
                modInfo.shutdown();
              }
            };

            app_router.on('route', sdHandler);
          }
        }
      });

      if (modules.length) {
        $('#app-links').fadeIn();
      }

      var mailChannels = BipClient.getCollection('channel').where({ action : 'email.smtp_forward'});

      var initLayout = function(action, params) {
        var tplHTML = _.template($('#tpl-layouts-' + action).html());
        appContent.html(tplHTML(params || {}));
      }

      var destroyView = function() {
        if (currentView && currentView.shutdown) {
          currentView.shutdown();
        }
      }

      app_router.on('route:defaultRoute', function (id, podName, mode) {
        app_router.navigate('#bipio', { trigger : true });
      });

      app_router.route('upgrade', function() {
        BipClient.growl('<span style="text-transform:capitalize"><i class="icon-ok-sign"></i> Upgraded to ' + userSettings.account_level.replace(/[-_]/g, ' ') + ' Plan');
        app_router.navigate('#bipio', { trigger : true });
      });

      Backbone.history.start();

      $('.greyified').removeClass('greyified');
    };

    return {
      initialize: initialize
    };
  });
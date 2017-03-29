/**
 *
 * BipIO graphs app
 *
 */
define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/community/views/v_bip_shared'
  ], function(_, Backbone, BipClient, BipSharedView) {

    var BipModuleView = Backbone.View.extend({
      el: '#community-container', // render widget to this container
      appID : 'community', // identify bips created with this app

      container : null,
      router : null,

      initialize : function(container, router) {
        var self = this;
        _.bindAll(
          this,
          'render'
        );
      },

      shutdown : function() {
      },

      // renders the app container
      render : function(id) {
        var self = this,
        tplHTML = _.template($('#tpl-layouts-' + this.appID).html());

        this.container.html(tplHTML());

        this._activeShareList = new BipSharedView(),

        this._activeShareList.render();
        this._activeShareList.on('shared-install', function(share, id) {
          if (share.exports && !Object.keys(share.exports).length) {
            delete share.exports;
          }
          BipClient.activeShare = share;
          self.router.navigate('bipio/new/shared/' + id, {
            trigger : true
          });
        });

        this._activeShareList.on('shared-refresh', function(id) {
          BipClient.getCollection('shared').fetch();
        });

        if (id) {
          this._activeShareList.setShare(id, function() {
            self._activeShareList.installShare();
          });
        }
      },

      appInfo : function(router, container) {
        var self = this,
          info = {
            name : this.appID,
            title : 'Community',
            ready : function(next) {
              // master route (router gobbles scope)
              router.route(self.appID, self.appID, function() {
                self.render.apply(self, arguments);
              });

              router.route(self.appID + '/:id', self.appID, function() {
                self.render.apply(self, arguments);
              });

              // ready!
              next();
            }
          };

        this.container = container;
        this.router = router;

        return info;
      }
    });

    return BipModuleView;
  });
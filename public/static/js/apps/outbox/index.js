/**
 *
 * BipIO graphs app
 *
 */
define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/outbox/views/v_outbox',
  ], function(_, Backbone, BipClient, OutboxView) {

    var BipModuleView = Backbone.View.extend({
      el: '#outbox-container', // render widget to this container
      appID : 'outbox', // identify bips created with this app

      container : null,
      router : null,

      obView : null,

      initialize : function() {
        var self = this;
        _.bindAll(
          this,
          'render'
        );
      },

      shutdown : function() {
      },

      // renders the app container
      render : function(mode, id) {
        var self = this,
          tplHTML = _.template($('#tpl-layouts-' + this.appID).html());

        this.container.html(tplHTML());

        this.obView = new OutboxView(mode, id);
        this.obView.render();
      },

      appInfo : function(router, container) {
        var self = this,
          info = {
            name : this.appID,
            title : 'Outbox',
            ready : function(next) {
              // master route (router gobbles scope)
              router.route(self.appID, self.appID, function() {
                self.render.apply(self, arguments);
              });

              router.route(self.appID + '/test/:id', self.appID, function(id) {
                self.render('test', id);
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
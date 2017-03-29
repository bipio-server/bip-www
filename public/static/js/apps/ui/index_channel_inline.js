/**
 *
 * BipIO graphs app.
 *
 * UI app container - for developing and testing views
 *
 */
define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/pods/views/v_channel_config',
  'apps/pods/views/v_channel_select_inline'
  ], function(_, Backbone, BipClient, ChannelConfigView, ChannelSelectView) {

    var BipModuleView = Backbone.View.extend({
      el: '#ui-container', // render widget to this container
      appID : 'ui', // identify bips created with this app

      container : null,
      router : null,

      obView : null,

      tplShareConfigEntity : _.template($('#tpl-bipio-share-cfg-entity').html()),

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

        this.test();
      },

      // !!!!!!!!!!!!!!!!!! implement injected view specific tests here
      test : function() {

        var pod = BipClient.find.pod('flow'),
          action = pod.getAction('generator');

        this.channelConfigView = new ChannelConfigView();

        this.channelConfigView.tplActionEntity = this.tplShareConfigEntity;

        var filteredAction = {
          name : action.name,
          title : action.title,
          trigger : action.trigger,
          config : {
            properties : action.config.properties,
            definitions : action.definitions
          }
        }

        var targetBip = BipClient.getCollection('bip').factory({
          type : 'trigger',
          config : {
            config : {

            }
          }
        });

        var $innerContent = this.channelConfigView.render(
          pod,
          action.name,
          filteredAction,
          targetBip.get('config'), // config container
          'active'
        );

        $('#ui-container .row .span12', this.$el).html($innerContent);
      },

      appInfo : function(router, container) {
        var self = this,
          info = {
            name : this.appID,
            title : 'UI',
            ready : function(next) {
              // master route (router gobbles scope)
              router.route(self.appID, self.appID, function() {
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
/**
 *
 * BipIO graphs app
 *
 */
define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/pods/views/v_channel_list',
  'apps/pods/views/v_channel_pod_list',
  ], function(_, Backbone, BipClient, ChannelListView, PodListView) {

    var PodsModuleView = Backbone.View.extend({
      el: '#pods-container', // render widget to this container
      appID : 'pods', // identify bips created with this app

      container : null,
      router : null,

      modalView : null,

      initialize : function(container, router) {
        var self = this;
        _.bindAll(
          this,
          'render',
          'shutdown'
        );
        this.container = container;
        this.router = router;
      },

      render : function() {
        var self = this;
      },

      shutdown : function() {
      },

      // renders the app container
      render : function(id, podName, mode) {
        var self = this,
          tplHTML = _.template($('#tpl-layouts-' + this.appID).html());

        this.container.html(tplHTML());

        $('#page-body .container').removeAttr('style');

        var channelsView = new ChannelListView(this.container, this.router);
        var podsView = new PodListView(this.container, this.router);

        channelsView.updateFilter();
        channelsView.setFilterContext();

        podsView.on('podSelected', function(args) {
          var filter, channel;

          if (args) {
            var pod = args.pod,
            channel = args.channel;

            if (pod) {
              filter = {
                attr : 'action',
                match: new RegExp('^' + pod.id)
              };
              channelsView.resetPage();
              channelsView.setFilterContext(pod);
            }
          }
          channelsView.updateFilter(filter, channel);
        });

        channelsView.render();

        currentView = channelsView;

        if (podName) {
          podsView.render();
          podsView.podSelect(BipClient.getCollection('pod').get(podName), 'browse' === mode);

        } else {
          podsView.render(id);
        }
      },

      appInfo : function(router, container) {
        var self = this,
          info = {
            name : this.appID,
            title : 'Pods',
            ready : function(next) {
              // master route (router gobbles scope)
              router.route(self.appID, self.appID, function() {
                self.render.apply(self, arguments);
              });

              router.route(self.appID + '/:id', self.appID, function() {
                self.render.apply(self, arguments);
              });

              router.route(self.appID + '/:id/:podName', self.appID, function() {
                self.render.apply(self, arguments);
              });

              router.route(self.appID + '/:id/:podName/:mode', self.appID, function() {
                self.render.apply(self, arguments);
              });

              // ready!
              next();
            },
            shutdown : function() {
              self.shutdown.apply(self, arguments);
            }
          };

        this.container = container;
        this.router = router;

        return info;
      }
    });

    return PodsModuleView;
  });
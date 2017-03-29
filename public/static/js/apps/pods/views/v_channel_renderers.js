define([
  'underscore',
  'backbone',
  'bipclient'
  ], function(_, Backbone, BipClient){
    var RenderersView = Backbone.View.extend({
      el : '#renderers-panel',
      tplRendererPanel : null, // paginator
      events : {
        'click .select-renderer button' : 'selectRenderer',
        'click .btn-remove-renderer' : 'selectRenderer'
      },

      initialize: function(el, parentContainer){
    	this.tplRendererPanel =  _.template($('#tpl-renderers').html());
        // element override
        if (el) {
          this.el = el;
          this.$el = $(el);
        }

        this.container = parentContainer;

        _.bindAll(this, 'render', '_applySelectedRendererHTML', 'selectRenderer');
      },

      _applySelectedRendererHTML : function(el, renderer) {
        var html,
          channel,
          pod,
          targetRenderer;

        if (!renderer || !Object.keys(renderer).length) {
          html = '<i class="icon-ban-circle"></i> No Responder Enabled';
        } else {

          if (renderer.channel_id) {
            channel = BipClient.getCollection('channel').get(renderer.channel_id);
            if (channel) {
              targetRenderer = _.findWhere(channel.get('_links'), { name : renderer.renderer });

              if (targetRenderer && Object.keys(targetRenderer).length) {

                pod = channel.getPod();

                html = '<img class="hub-icon hub-icon-24" src="' + channel.getPodIcon() + '"> '
                + '<strong>' + pod.get('title') + ' : ' + channel.get('name') + '</strong>'
                + ' ' + targetRenderer.title + ' (' + targetRenderer.contentType + ')'
                + '<button class="btn btn-mini btn-danger pull-right btn-remove-renderer">Remove</button>';
              }
            }
          } else if (renderer.pod) {
            pod = BipClient.getCollection('pod').get(renderer.pod);
            if(pod) {
            	targetRenderer = pod.get('rpcs')[renderer.renderer];

                html = '<img class="hub-icon hub-icon-24" src="' + pod.getIcon() + '"> '
                  + '<strong>' + pod.get('title') + '</strong>'
                  + ' ' + targetRenderer.title + ' (' + targetRenderer.contentType + ')'
                  + '<button class="btn btn-mini btn-danger pull-right btn-remove-renderer">Remove</button>';
            }
          }
        }

        el.html(html);
      },

      render: function(renderer) {
        var dict = {
          rendererChannels : BipClient.getCollection('channel').getRenderable(true),
          rendererPods : BipClient.getCollection('pod').getRenderable()
        }

        this.$el.html(
          this.tplRendererPanel(dict)
        );

        this._applySelectedRendererHTML($('.renderer-selected', this.container), renderer);

        $('#include-channel-invoke').on('click', function(ev) {
          var $el = $(ev.currentTarget),
          $allRenderers = $('.renderer-container', $el.parents(this.container));

          if ($el.is(':checked')) {
            $('.hide', $allRenderers).removeClass('hide').addClass('hide_disabled');
          } else {
            $('.hide_disabled', $allRenderers).removeClass('hide_disabled').addClass('hide');
          }
        });

        return this;
      },

      selectRenderer : function(ev) {
        var $button = $(ev.currentTarget),
          parent = $button.parent(),
          cid = parent.attr('data-channel-id'),
          pod = parent.attr('data-pod-id'),
          renderer = parent.attr('data-renderer'),
          $activeEl = $(this.container + ' .renderer-selected');

        if ($button.hasClass('btn-enable-renderer')) {

          var renderStruct = {
            renderer : renderer
          };

          if (cid) {
            renderStruct.channel_id = cid;
          } else if (pod) {
            renderStruct.pod = pod;
          }

          this._applySelectedRendererHTML($activeEl, renderStruct);

          this.trigger('renderer:add', renderStruct)

        } else if ($button.hasClass('btn-remove-renderer')) {
          this._applySelectedRendererHTML($activeEl);
          this.trigger('renderer:remove');

        } else if ($button.hasClass('btn-preview-renderer')) {

          BipClient.openRenderer(parent.attr('data-channel-id'), parent.attr('data-renderer'));
        }

        return false;
      }
    });

    return RenderersView;
});
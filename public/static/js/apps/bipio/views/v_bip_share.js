define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/pods/views/v_channel_config'
  ], function(_, Backbone, BipClient, ChannelConfigView){
      BipShareView = Backbone.View.extend({
        el: '#bip-share',

	      tplBipShare :  _.template( $('#tpl-bipio-share').html() ),
	      tplBipShareCfg :  _.template( $('#tpl-bipio-share-cfg').html() ),

	      tplShareConfigEntity : _.template($('#tpl-bipio-share-cfg-entity').html()),

	      model : null,
	      configView : null,
        events: {
        },
        initialize:function () {
          var self = this;
            _.bindAll(
              this,
              'share'
            );

          this.collection = BipClient.getCollection('bip');
        },

        // tests if a property for the channel is protected/unsharable
        _isProtected : function(cid, propName) {
          var channel = BipClient.find.channel(cid);

          // clear reference data or user entered input
          // if also a config item
          if (channel.getAction().config
            && channel.getAction().config.properties
            && channel.getAction().config.properties[propName]
            && channel.getAction().config.properties[propName].oneOf
            && channel.getAction().config.properties[propName].oneOf[0]['$ref']
            && 0 === channel.getAction().config.properties[propName].oneOf[0]['$ref'].indexOf('/rpcs')
            ) {

            return true;
          }

          return false;
        },

        // scrubs personal info from import/config merges in the hub
        _scrub : function(modelJSON) {
          var self = this,
            hub = modelJSON.hub,
            channel, properties, configs;

          _.each(hub, function(edge, node) {
            if (edge.transforms) {
              _.each(edge.transforms, function(transforms, cid) {
                _.each(transforms, function(value, propName) {
                  if (self._isProtected(cid, propName)) {
                    delete transforms[propName];
                  }
                })
              });
            }
          });

          if ('trigger' === modelJSON.type && modelJSON.config.config) {
            _.each(modelJSON.config.config, function(value, propName) {
              if (self._isProtected(modelJSON.config.channel_id, propName)) {
                delete modelJSON.config.config[propName];
              }
            });
          }

          return modelJSON;
        },

        share : function(bipModel) {

         	var dict = {
        			title : bipModel.getTypeRepr(),
        			icon : bipModel.getIcon(),
              exports : bipModel.get('exports'),
        			name : bipModel.get('name'),
        			note : bipModel.get('note'),
              schedule : bipModel.get('schedule'),
              username : userSettings.username,
              slug : bipModel.get('name').toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-')
	        	},
	        	channel,
	        	pod,
	        	action,
	        	configSchema,
        		self = this,
        		$shareTpl,
        		$modal,
        		$header;

        	$shareTpl = this.tplBipShare(dict);

        	this.$el.html($shareTpl);

        	$modal = $('#share-modal', this.$el);

        	$header = $('h2', $modal);

        	// check for trigger config
        	if ('trigger' === bipModel.get('type')) {
        		channel = BipClient.getCollection('channel').get(bipModel.get('config').channel_id);
        		pod = channel.getPod(),
        		action = channel.getAction(),
        		configSchema = action.config.properties;

        		var customConfigs = {},
        			filteredProps = {};

        		_.each(channel.get('config'), function(value, key) {
        			// ignore
        			if (configSchema[key] && 'string' === configSchema[key].type && value && !configSchema[key].oneOf) {
        				customConfigs[key] = value;
        				filteredProps[key] = configSchema[key];
        			}
        		});

        		// inject string configs
        		if (Object.keys(customConfigs).length) {

        			this.channelConfigView = new ChannelConfigView();

        			// override action entity
        			this.channelConfigView.tplActionEntity = this.tplShareConfigEntity;

        			var $cfgContainer = $(this.tplBipShareCfg({
        				icon : channel.getIcon(),
        				description : pod.get('title') + ' - ' + action.title
        			}));

							$('#share-trigger-config', this.$el).html($cfgContainer);

							var filteredAction = {
								name : action.name,
								title : action.title,
								trigger : action.trigger,
								config : {
									properties : filteredProps,
									definitions : action.definitions
								}
							}

        			var $innerContent = this.channelConfigView.render(
	              pod,
	              action.name,
	              filteredAction,
	              BipClient.getCollection('channel').newModel({
	                action : channel.get('action'),
	                config : customConfigs
	              }),
	              'active',
	              Object.keys(customConfigs)
              );

        			$('.action-list', this.$el).html($innerContent);
        		}
        	}

        	$('#confirm-share', $modal).click(function() {
        		self.end();
        	});

          $modal.on('shown', function() {
            BipClient.centerModal($('.modal', $modal));
          });

        	$modal.modal('show').on('hidden', function() {
        		$modal.remove();
        		$('#confirm-share', $modal).unbind('click');
        	});

          var $slug = $('#share_slug');

          $slug.on('keyup', function() {
            self._updateRepr($(this).val());
          });

          self._updateRepr($slug.val());

          $('#share_slug_preview').prepend(
            this._getURLBase()
          );

          $('#share_slug_repr').on('click', BipClient.selectContents);

/*
          $('#share_slug_repr').tooltip({
            placement: 'top'
          });
*/
        	this.model = bipModel;
        },

        _getURLBase : function() {
          return BipClient.getSiteURL() + '/share/' + userSettings.username;
        },

        _updateRepr : function(value) {
          var $repr = $('#share_slug_repr');
          value = value.trim();
          if (!value) {
            $repr.addClass('alert-danger');
            $repr.removeClass('alert-neutral');
            $('#confirm-share').prop('disabled', true);
          } else {
            $repr.addClass('alert-neutral');
            $repr.removeClass('alert-danger');
            $('#confirm-share').prop('disabled', false);
          }

          $repr.html(
            this._getURLBase() + '/' + $('#share_slug').val()
          );
        },

        end : function() {
          var shareModel = this._scrub(BipClient.deepClone(this.model.toJSON()));

        	shareModel.note = $('#share_note').val();

          if ($('#share_slug').val().length && $('#share_slug').val().match(/^[a-zA-Z0-9_\-]*$/)) {
            shareModel.slug = $('#share_slug').val();
          }
          else  {
            shareModel.slug = shareModel.name.toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-');
          }

        	if ('trigger' === shareModel.type) {
            if (BipClient.isUUID(shareModel.config.channel_id)) {
          		shareModel.config.config = BipClient.getCollection('channel').get(shareModel.config.channel_id).toJSON().config;
            }

        		// merge sharing users config into their saved channel
            if (this.channelConfigView) {
  	          var config = this.channelConfigView.serialize().config;

  	          _.each(config, function(value, key) {
  	          	shareModel.config.config[key] = value;
  	          });
            }
        	}

          BipClient.share(shareModel, function(err, resp) {
            if (err) {
              BipClient.growl(resp, 'error');
            } else {
              BipClient.growl('Thanks For Sharing!');
            }
            BipClient.getCollection('bip_shares').fetch();
          });
          $('#share-modal', this.$el).modal('hide');
        }
      });

      return BipShareView;
  });
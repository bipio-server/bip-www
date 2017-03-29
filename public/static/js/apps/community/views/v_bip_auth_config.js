define([
	'underscore',
	'backbone',
	'bipclient',
	'apps/pods/views/v_channel_pod_list'
	], function(_, Backbone, BipClient, PodListView){
		var BipAuthConfigModal = Backbone.View.extend({
			data : null,
			ptr : null,
			initialize: function(activeShare) {
				var self = this;
				_.bindAll(
					this,
					'render',
					'close',
					'stepOne',
					'install',
					'activate',
					'spanwModal'
				);

				this._activeShare = activeShare;
				this.activeShareManifest = this._activeShare.get('manifest');
				this.stepOneTpl = _.template($('#tpl-modal-share-setup-step-one').html());
				this.stepTwoTpl = _.template($('#tpl-modal-share-setup-step-two').html());

				this.podView = new PodListView();

				this.podView.on('pod:auth', function(provider) {
					_.each(
						_.where(
							self.data.actions,
							{
								name : provider
							}
						), function(action) {
							action.isActivated = true
						}
					);

					self.stepTwo(true);
				});

				this.shareModal = $('#sharedModal');
			},

			close : function() {
				this.unbind();
				this.remove();
				this.podView.unbind();
				this.podView.close();
				delete this.podView;
			},

			render : function() {
				var data = this.stepOne(),
					self = this;

				if (data) {
					this.shareModal.modal();
					this.spanwModal(this.stepOneTpl(data));
					// attach events
					$('div:first-child', this.shareModal).first().modal();

					// start install
					$('#share-setup-action', this.shareModalContent).click(function(ev) {
						self.stepTwo();
						return false;
					});

				} else if (null === data) {
					return;

				} else {
					this.install();
				}
			},

			activate: function(podName) {
				this.podView._authModalSpawn(BipClient.getCollection('pod').get(podName), false, '#sharedModal')
			},

	    install: function() {
				var share = this._activeShare.toJSON(),
		      struct = {
		      	name : share.name,
		      	type : share.type,
		      	config : share.config ? BipClient.deepClone(share.config) : {},
		      	hub : BipClient.deepClone(share.hub),
		      	note : share.note,
		      	schedule : share.schedule,
						icon : share.icon,
						exports : share.exports
		      };

				// This is where the bip is installed. Last step in the entire process
				this.trigger('shared-install', struct, this._activeShare.id)
			},

			spanwModal : function(template) {
				var self = this;

				this.shareModalContent = $('.modal-container', this.shareModal);

				this.shareModalContent.html(template).modal();
			},

			checkPerm : function(pod) {
				if (pod.get('level_locked')) {
          BipClient.confirmNavModal({
            cb: function(ev) {
              BipClient.selectPlanRoute('pod_exclusions', pod.get('title'));
              return false;
            },
            title : '<img src="' + pod.getIcon() + '"/> Upgrade Required',
            body : pod.get('title') + ' is a Premium pod and requires a plan upgrade to use',
            confirm : 'Upgrade'
          });
          return false;
        }

        return true;
			},


			stepOne : function() {
				var self = this,
					data = {
						name: this._activeShare.get('name'),
						description: this._activeShare.get('note'),
						actions: []
					},
					manifest = this.activeShareManifest,
					authManifest = [];

				this.data = data;

				var offset = 0,
					pod;

				for (var k in manifest) {
					pod = BipClient.find.channel(manifest[k]).getPod();
					// if permissioned
					if (self.checkPerm(pod) ) {
						if (!pod.isAuthed()) {
							authManifest.push(manifest[k]);
						}
					} else {
						return null;
					}
				}

				if (!authManifest.length) {
					return false;
				} else {
					var actionTokens;
					for (var i = 0; i < authManifest.length; i++) {

						actionTokens = authManifest[i].split('.');

						if (!_.findWhere(data.actions, { name : actionTokens[0] })) {
							data.actions[i] = {
								name: actionTokens[0],
								action: actionTokens[1],
								current: false
							}
						}
					}

					return data;
				}
			},

			stepTwo : function() {
				var self = this;

				this.ptr = this.data.actions.shift();

				if (!this.ptr) {
	  			this.install(this.data);
	  			return;
	  		}

	  		action = this.ptr;

		  	// auth modal
		  	if (!action.isActivated) {
		  		self.activate(this.ptr.name);
		  		return;
		  	} else if (this.ptr.channelId) {
		  		self.stepTwo();
		  		return;
		  	}

				// setup config
				this.spanwModal( this.stepTwoTpl({ data : this.data, action : this.ptr} ) )

			}
	});

	return BipAuthConfigModal;
})
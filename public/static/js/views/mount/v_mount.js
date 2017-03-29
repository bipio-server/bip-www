define(
		[ 'underscore', 'backbone', 'bipclient', ],
		function(_, Backbone, BipClient) {
			// Individual Domain
			var MountView = Backbone.View
					.extend({
						el : $('#mount-ctl'),
						tpl: null,
						serverVersion : '0.3.13',
						events : {
							"click #mount-new-btn" : "publish",
							"click .btn-verify" : "verify",
							"click .btn-delete" : "remove",
							"click .btn-active" : "activate"
						},
						initialize : function() {
							this.tpl =  _.template($('#tpl-mount-entity').html());
							_.bindAll(this, 'render', 'renderRow', '_validate',
									'verify', 'activate', 'appendRow',
									'errTranslate', 'remove', 'removeRow',
									'updateRow', 'publish');
							this.collection.bind('reset', this.render);
						},
						renderRow : function(mount) {
							var struct = mount.toJSON(), html;
							return this.tpl(struct);
						},
						updateRow : function(mount) {
							var innerHTML = $('.well', this.renderRow(mount));
							$('#mount-entity-' + mount.id).html(innerHTML);
						},
						removeRow : function(mount) {
							$('#mount-entity-' + mount.id).remove();
						},
						appendRow : function(mount) {
							var el = $('#mount-list', this.el);
							el.append(this.renderRow(mount));
						},
						render : function() {
							var self = this;
							$('#mount-list', this.el).html('');

							this.collection.models.forEach(function(mount) {
								var currentMount = mount.toJSON();

								$.ajax({
									url : currentMount.url + '/status',
									method : 'GET',
									success : function(response) {
										if (self.versionToInt(response.version) < self.versionToInt(BIPClientParams.apiVersion)) {
											mount.set("version",response.version);
											mount.set("apiMinversion",BIPClientParams.apiVersion);
								            self.appendRow(mount);	//show error
										}else{
											self.appendRow(mount);
										}

									},
									error : function(xhr) {
										if (xhr.status == "404") {
											mount.set("version","0.0.0");
											mount.set("apiMinversion",BIPClientParams.apiVersion);
											self.appendRow(mount);	//show error
										}
									}
								});

							});
							$('.tooltippable').tooltip();
							return this;
						},
						// translates from a model attribute to form, and
						// renders an error
						errTranslate : function(isErr, error) {
							var el = $('#mount-name-new', this.el).parent();
							if (isErr) {
								el.addClass('error');
								el.children('.help-block').html(error);
							} else {
								el.removeClass('error');
								el.children('.help-block').html('');
							}
						},
						publish : function(ev) {
							var self = this;
							this._validate(function(mount) {
								self.collection.create(mount);
								if (self.collection.models.length === 1) {
									self.collection.activate(self.collection.models[0].id);
								}
								self.render();
							});
						},

						activate : function(ev) {

							var mountId = $(ev.currentTarget).attr(
									'data-model-id');
							var mount = {};
							mount = this.collection.get(mountId).toJSON();
							this._validateServerVersion(mount.url);
							this.collection.activate(mountId);
							this.render();
						},

						verify : function(ev) {
							this._validate(undefined, $(ev.currentTarget).attr(
									'data-model-id'));
						},

						versionToInt : function(pkgVersion) {
							var newVersionInt = pkgVersion.split('.').map(
									function(token) {
										var i = Number(token);
										if (!isNaN(i) && token < 10) {
											i = '0' + i;
										}
										return i;
									});
							return Number(newVersionInt.join(''));
						},

						_validateServerVersion : function(serverUrl) {
							var self = this;
							$.ajax({
										url : serverUrl + '/status',
										method : 'GET',
										success : function(response) {
											// no growl on out of date
											if (false && self.versionToInt(response.version) < self.versionToInt(BIPClientParams.apiVersion)) {
												BipClient
														.growl(
																'Unsupported Bipio server version , it should be less or equal to '
																		+ BIPClientParams.apiVersion,
																'error')
											}

										},
										error : function(xhr) {
											if (xhr.status == "404") {
												BipClient
														.growl(
																'Unsupported Bipio server version , it should be at least '
																		+ BIPClientParams.apiVersion,
																'error')
											}
										}
									});

							$.ajax({ url : '/mounted'});
						},

						_validate : function(next, id) {

							var form = $('form#new-mount'), label = form
									.find('#mount-label'), url = form
									.find('#mount-endpoint'), username = form
									.find('#mount-username'), token = form
									.find('#mount-token'), sessionOnly = form
									.find('#mount-session-only'), els = {

								label : label,
								url : url,
								username : username,
								token : token,
								sessionOnly : sessionOnly
							}, v, parent, help, mount = {}, ok = true;

							if (id && '' !== id) {
								mount = this.collection.get(id).toJSON();
							} else {
								for (el in els) {
									if (els.hasOwnProperty(el)
											&& 'sessionOnly' !== el) {

										v = els[el].val();
										parent = els[el].closest('.control-group');
										help = els[el].siblings('.help-block');

										if (v !== '') {
											mount[el] = v;
											parent.removeClass('error');
											help.html('');
										} else {
											parent.addClass('error');
											help.html('required');
											ok = false;
										}

									}
								}
							}

							mount.url = mount.url.replace(/\/+$/, '');

							if (ok) {

								this._validateServerVersion(mount.url);

								BipClient.setCredentials(mount.username, mount.token);

								$.ajax({
									url : mount.url + '/login',
									method : 'GET',
									success : function() {
										BipClient.growl(mount.label+ ' looks alive');
										BipClient.setCredentials();
										if (next) {
											next(mount);
										}
									},
									error : function() {
										BipClient.growl(mount.label
												+ ' mount failed verification',
												'error');
										BipClient.setCredentials();
									}
								});
							} else if (ok && next) {
								next(ok, mount);
							}
						},

						remove : function(ev) {
							var src = $(ev.currentTarget), id = src
									.attr('data-model-id'), model = this.collection
									.get(id), self = this;

							ev.preventDefault();
							model.destroy({
								success : function(mount, response) {
									self.removeRow(mount);
									BipClient.growl('Mount Deleted');
								},
								error : function(model, response) {
									console.log(reponse);
								}
							});
						}
					});

			return MountView;
		});
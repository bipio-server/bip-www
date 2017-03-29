define([
  'underscore',
  'backbone',
  'bipclient',
  'models/m_channel',
  'models/m_bip',
  'apps/pods/views/v_channel_config',
  'apps/pods/views/v_channel_logs',
  'apps/bipio/views/v_bip_list'
  ], function(_, Backbone, BipClient, ChannelModel, BipModel, ChannelConfigView, ChannelLogsView, BipListView){
    // Individual Pod
    var PodListView = Backbone.View.extend({
      el : '#channel-setup',

      tplModal : _.template($('#tpl-modal-auth').html()),
      tplAuthIsuuerToken : _.template($('#tpl-auth-issuer-token').html()),

      tplPodSelect : _.template($('#tpl-pod-select').html()),
      tplPodEntity : _.template($('#tpl-pod-entity').html()),
      tplActionEntity : _.template($('#tpl-action-entity').html()),

      tplActionSelect : _.template($('#tpl-action-select').html()),

      tplPostSave : _.template($('#tpl-post-save-dialog').html()),

      events: {
        "click .btn-verify" : "verify",
        "click .save-channel" : "saveChannel",
        "click #channel-delete-confirm" : "remove",
        "click .reauth" : "reauthPod"
      },

      model : null,
      _router : null,
      configView : null,

      podFilters : [],

      initialize: function(container, router, searchType){
        var self = this;
        _.bindAll(
          this,
          'render',
          'reset',
          'renderRow',
          'updateRow',
          'verify',
          'verifyIssuerToken',
          'podSelect',
          'search',
          'authModal',
          'reauthPod', // deprecating
          '_authModalSpawn',
          'saveChannel',
          'remove',
          'getBipsForChannel',

          // validation
          'validatedPublish',
          'invalidModel',
          'errTranslate',
          '_credentialError',

          '_renderPods',
          '_renderChannel',
          //'_attachChannelOptions'

          '_deAuthHandler',
          '_authEvent'
          );

        this.collection = BipClient.getCollection('pod');
        this.collection.sort();
        this._searchType = searchType || 'all';

        if (router) {
          this.collection.bind('reset', this.render);
          this.collection.bind('change', this.render);
        }

        this._router = router;
        this._configView = new ChannelConfigView();

        BipClient.authStatusChangeEvent.on(this._authEvent);
      },

      _authEvent : function(args) {
        if ('accepted' === args.newstatus) {
          this.trigger('pod:auth', args.provider);
        } else if ('disabled' === args.newstatus) {
          this.trigger('pod:deauth', args.provider);
        }
      },

      render: function(id) {
        var self = this;

        if (!this._router) {
          return;
        }

        this.$el.html(this.tplPodSelect());

        if (id) {
          var model = BipClient.getCollection('channel').get(id),
          podTokens;

          if (model) {
            podTokens = model.get('action').split('.');

            this._renderChannel(model, this.collection.get(podTokens[0]));
            this.model = model;

          } else {
            BipClient.growl('Action Does Not Exist', 'error');
            this._renderPods();
          }
        } else {
          this._renderPods();
        }

        $('#pod-search-form', this._container).on('keyup', function() {
          self.search($(this).val());
        });

      },

      close : function() {
        this.unbind();
        BipClient.authStatusChangeEvent.unbind(this._authEvent);
      },

      reset : function() {
        this.render();
      },

      search : function(str) {
        var filters = _.map(str.split(','), function(val) {
          return val.trim();
        });

        this.podFilters = [];

        for (var i = 0; i < filters.length; i++) {
          if (filters[i]) {
            this.podFilters.push(filters[i]);
          }
        }

        this._renderPods(true);
      },

      _renderPods : function(search, podFilters) {
        var self = this,
          searchType = this._searchType,
          podFilters = podFilters || self.podFilters;

        this.model = new ChannelModel();

        var renderInto = $('#pod-list', this.$el);

        renderInto.empty();

        if (search && !podFilters) {
          podFilters = self.podFilters;
        }

        this.collection.models.forEach( function (pod) {
          var match = search ? false : true,
            matchStr,
            typeMatch = false,
            filter;


          if (search || searchType) {
            matchStr = pod.get('name') + ' ' + pod.get('title') + ' ' + pod.get('tags');

            if (pod.get('tags')) {
              _.each(pod.get('tags'), function(tag) {

                if ('all' === searchType) {
                  typeMatch = true;
                }

                matchStr += ' ' + tag;
              });
            };

            _.each(pod.get('actions'), function(action, key) {

              if ('all' === searchType
                || ('actions' === searchType && 'invoke' === action.trigger)
                || ('emitters' === searchType && 'invoke' !== action.trigger) || ('emitters' === searchType && 'http' === action.trigger)) {
                typeMatch = true;
              }

              matchStr += ' ' + key + ' ' + action.title;
            });

            if (podFilters.length) {
              // rudimentary search, no weighted matches
              for (var i = 0; i < podFilters.length; i++) {
                if (podFilters[i]) {
                  filter = new RegExp(podFilters[i], 'gi');

                  match = filter.test(matchStr);

                  if (match) {
                    break;
                  }
                }
              }
            }
          }

          if ( (match && typeMatch) || (typeMatch && !podFilters.length)) {
            self.renderRow(pod, renderInto);
          }
        });

        return this;
      },

      renderActionRow : function (channel, pod, model, availableActions, filter, activeClass){
    	  var self = this;

    	  if(!activeClass)
    		  activeClass = '';
    	  var match = (filter && filter.length) ? false : true;
          if (channel.id) {
            $('#renderers li').click(function() {
              var el = $(this);
              BipClient.openRenderer(el.attr('data-cid'), el.attr('data-renderer'));
              return false;
            });
          }

          actionList = $('.action-list', this.$el);

          if (model.remainingActions > 0) {
            actionList.empty();
          }

          for (action in availableActions) {
            if (channel.id && channel.get('action') == pod.get('name') + '.' + action) {
              selectedAction = true;
              activeClass = 'active';
            } else {
              selectedAction = false;
            }

            if(filter && filter.length){
          	  	match = false;
          	  	currentAction =  availableActions[action];
          	  	matchStr = currentAction.name + ' ' + currentAction.title + ' ' + currentAction.tags;
  		         if (currentAction.tags) {
  		                _.each(currentAction.tags, function(tag) {
  		                  if ('all' === searchType) {
  		                    typeMatch = true;
  		                  }
  		                  matchStr += ' ' + tag;
  		                });
  		          };

  	              for (var i = 0; i < filter.length; i++) {
  	                  if (filter[i]) {
  	                    actionFilter = new RegExp(filter[i], 'gi');

  	                    match = actionFilter.test(matchStr);

  	                    if (match) {
  	                      break;
  	                    }
  	                  }
  	              }

            }

            if(!filter || match){
                actionList.append(
        	            this._configView.render(
        	              pod,
        	              action,
        	              availableActions[action],
        	              channel,
        	              activeClass
        	            )
        	          );
            }
         }

          // action selected
          $('.action-list .action').click(function(ev, trigger) {

            if (!$(this).hasClass('active') && !$(this).hasClass('browsing')) {
          	$('#action-search').hide()
              $('.action-list .action').prop('checked', false).trigger('change').removeClass('active');
              $('.action-list .action input').attr('disabled', true);

              var ptr = $('input.action-selected', $(this)).attr('value')
                schema = BipClient.getCollection('pod').getActionSchema( ptr ),
                podName = ptr.split('.')[0];

              if (self.model.isNew()) {
                $('#channel_name').val(schema.title);
                $('#channel_note').attr('placeholder', schema.description);

                $('.cancel-channel').html('&laquo; Back').on('click', function(ev) {
                  Backbone.history.loadUrl(Backbone.history.fragment);

                  //self._router.navigate('channels/pod/' + $(this).attr('data-pod'), { trigger : true });
                  ev.preventDefault();
                  ev.stopPropagation();
                });
              }

              $(this).addClass('active');
              $(this).find('input').removeAttr('disabled')

              //$('.save-channel').removeClass('disabled');
              $('.hidden', self.$el).removeClass('hidden');
              $('.show', self.$el).removeClass('show').addClass('hidden');
              $('.action-selectable').not('.active').hide();

              $('.hidden', self.$el).remove();

              $(this).find('input[name="action"]').prop('checked', true).trigger('change');
              if(!trigger){
            	  self.trigger('view:actionSelected', schema, podName);
              }
            }
          });


      },

      _renderChannel : function(channel, pod, cb, noconfig) {
        var actionList,
          actionJSON,
          actions = pod.get('actions'),
          action,
          activeClass = '',
          actionHTML,
          selectedAction = false,
          match = true,
          matchStr,
          self = this,
          model = {
            'pod' : pod.toJSON(),
            'channel' : channel.toJSON(),
            'configure' : !noconfig, // just browsing mode
            'remainingActions' : Object.keys(actions).length
          },
          availableActions = {},
          self = this,
          typeMatch = false,
          searchType = this._searchType,
          haveAction,
          sortedActions = _.sortBy(actions, function(action, key) {
            action.name = key;
            return action.title;
          });

        for (var i = 0; i < sortedActions.length; i++) {
          action = sortedActions[i];

          typeMatch = false;

          if ('all' === searchType
            || ('actions' === searchType && 'invoke' === action.trigger)
            || ('emitters' === searchType && 'invoke' !== action.trigger) || ('emitters' === searchType && 'http' === action.trigger)) {
            typeMatch = true;
          }

          haveAction = BipClient.getCollection('channel').where({
            action : pod.get('name') + '.' + action.name
          } ).length > 0;
          if (channel.id && channel.get('action') == pod.get('name') + '.' + action.name) {
            selectedAction = true;
            activeClass = 'active';
          } else {
            selectedAction = false;
          }

          if (typeMatch) {
            if (!noconfig &&
              (
                (action.singleton && !channel.id && haveAction)
                || (channel.id && !selectedAction)
                )) {
              model.remainingActions--;
            } else {
              availableActions[action.name] = action;
            }
          }
        }

        model.configure = model.configure && model.remainingActions;
        model.hasBips = this.getBipsForChannel(channel.id).length;

        this.trigger('podSelected', {
          pod : pod,
          channel : channel
        });

        this.$el.html(this.tplActionSelect(model));

        // setup action search
        $('#action-search-form', this.$el).focus().on('keyup', function(ev) {
            if (ev.keyCode === 27) {
              self.trigger('view:cancel');
              return;
            }

            var searchStr = $(this).val(),
              actionFilter = [];

	          filters = _.map(searchStr.split(','), function(val) {
	               return val.trim();
	          });

	            for (var i = 0; i < filters.length; i++) {
	              if (filters[i]) {
	            	  actionFilter.push(filters[i]);
	              }
	            }
	            self.renderActionRow(channel, pod, model, availableActions, actionFilter, activeClass);

          });
        this.renderActionRow(channel, pod, model, availableActions, [], activeClass);

        function setEmptyFlag($el) {
          var empty = !$el.val().replace(/\s*/, ''),
            $parent = $el.parent();

          if (empty) {
            $parent.attr('empty', true);
          } else {
            $parent.removeAttr('empty');
          }
        }

        //$('select', actionList).css('width', '300px');

        // button group > radio bindings
        $('.btn-group button').on('click', function(ev) {
          $(this).siblings("input[type=hidden]").val($(this).attr('data-selection'));
        });


        this.$el.tab().on('shown', function(e) {
          if (e.target.hash === '#channel_bips') {
            var bipListView = new BipListView(
              $('#bip-list-container'),
              this.router
            );

            models = self.getBipsForChannel(channel.id);

            bipListView.render(true, models);

            $('#list-bip-container').addClass('row');

          } else if (e.target.hash === '#channel-data-panel') {
            $('#channel-data-panel pre').html(
              jsl.format.formatJson(JSON.stringify(self.model.toJSON()))
              );
          } else if (e.target.hash === '#channel-logs-panel') {
            var target = $('#log-body', e.target.hash);

            // load the log
            if (!target.html()) {
              new ChannelLogsView(target, self.model.id);
            }
          }


        }).tab('show');

        // required field toggles
        $('[required] input').bind('propertychange keyup input paste', function() {
          setEmptyFlag($(this));
        });

        $('[required] input:not(#channel_name)').each(function(idx, el) {
          setEmptyFlag($(el));
        });

        if (cb) {
          cb();
        }
      },

      getBipsForChannel : function(cid) {
        return BipClient.getCollection('bip').filter(function(bip) {
          return -1 !== bip.get('_channel_idx').indexOf(cid)
        });
      },

      // translates from a model attribute to form, and renders an error
      errTranslate: function(isErr, attribute, error) {
        var el = $('#channel_' + attribute.replace('config.', ''), self.el).closest('.control-group');

        if (isErr) {
          el.addClass('error');
          el.find('.help-block').html(error);
        } else {
          el.removeClass('error');
          el.find('.help-block').empty();
        }
      },

      invalidModel : function(model, errors) {
        this.validatedPublish();

        this.errTranslate(false, 'name');
        this.errTranslate(false, 'note');

        for (key in errors) {
          this.errTranslate(true, key, errors[key]);
        }
      },

      // clear all validation errors
      validatedPublish : function(model, attr) {
        $('.control-group').removeClass('error');
        $('.help-block').empty();
      },

      saveChannel : function(ev,model) {
        var $btn = $(ev.currentTarget),
        self = this,
        values, oldVal;

        ev.preventDefault();

  	    if (!$btn.hasClass('disabled')) {
  			          // drop inactive form elements
  			   $('.action-selectable:not(.active)').remove();
  			   //check if model parameter is empty then generate the model from the form
  			   if (model === undefined) {
  				   var model={};
  	          // get active action content
  	          values = $('form.create-new-channel').serializeArray();

  	          var path, ref, value, name, tokens;

  	          for (var i = 0; i < values.length; i++) {
  	            value = values[i].value;
  	            tokens = values[i].name.split('#');

  	            // qualified object path
  	            if (tokens.length > 1) {
  	              name = tokens[0];
  	              if (!model[name]) {
  	                model[name] = {};
  	              }
  	              ref = model[name];

  	              path = tokens[1].split('/');

  	              //
  	              for (var j = 0; j < path.length; j++) {
  	                name = path[j];
  	                if (j === (path.length - 1)) {
  	                  // transform into array
  	                  if (ref[name]) {
  	                    if ($.isArray(ref[name])) {
  	                      ref[name].push(value);
  	                    } else {
  	                      ref[name] = [ ref[name], value ]
  	                    }

  	                  } else {
  	                    ref[name] = value;
  	                  }
  	                } else {
  	                  if (!ref[name]) {
  	                    ref[name] = {};
  	                  }
  	                  ref = ref[name];
  	                }
  	              }

  	            // literal attribute
  	            } else {
  	              name = values[i].name;
  	              model[name] = value;
  	            }
  	          }
  		      }

            if (this.model && !this.model.isNew()) {
              this.model.set(model);
            } else {
              this.model = new ChannelModel(model);
            }

            this.model.on('validated:invalid', this.invalidModel, this);
            this.model.on('validated:valid', this.validatedPublish, this);
            Backbone.Validation.bind(this);

            // inject config validation rules from the pod schema into
            // the model
            var tokens = this.model.get('action').split('.'),
            pod = BipClient.getCollection('pod').get(tokens[0]),
            actionConfig = pod.get('actions')[tokens[1]].config.properties,
            vStruct, c;

            for (key in actionConfig) {
              c = actionConfig[key];
              vStruct = [];
              if (!c.optional) {
                vStruct.push({
                  'required' : true,
                  'msg' : 'Required'
                });
              }

              if (c.validate) {
                for (var k = 0; k < c.validate.length; k++) {
                  vStruct.push(c.validate[k]);
                }
              }
            }

	          this.model.validate();

	          if (this.model.isValid(true)) {
	            $btn.button('loading');
	            var newModel = this.model.isNew(),
	              currModel = BipClient.getCollection('channel').findWhere({ 'name' : this.model.get('name') });

	            // when name collision and no config, use the colliding channel
	            if (!Object.keys(actionConfig).length && currModel) {

	              self.trigger('refresh');

	              //
	              if (!self._router) {
	                self.trigger('channel:saved', currModel);
	              } else {
	                self._router.navigate('pods', true);
	                self.reset();
	              }

	            } else {
	              this.model.save(
	                this.model.toJSON(),
	                {
	                  silent  : false,
	                  sync    : false,
	                  success : function(model, res, xhr) {
	                    $btn.button('reset');
	                    // clear search
	                    //$('#channel-search-form').val('');
	                    //BipClient.getCollection('channel').resetSearch().fetch({
	                    BipClient.getCollection('channel').fetch({
	                      reset : true,
	                      success : function() {
	                        BipClient.decorateChannels();

	                        self.trigger('refresh');

	                        //
	                        if (!self._router) {
	                          self.trigger('channel:saved', model);
	                        }
	                      }
	                    });

	                    if (self._router) {
	                      self._router.navigate('pods', true);
	                      self.reset();
	                    }

	                    BipClient.growl('Action <strong>' + self.model.get('name') + '</strong> Saved');

	                  },
	                  error: function(model, res) {
	                    $btn.button('reset');
	                    var resp = JSON.parse(res.responseText);
	                    // conflict
	                    if (res.status === 409) {
	                      self.errTranslate(true, 'name', 'Action Name is already in use');

	                    // handle general errors
	                    } else {
	                      if (resp.message) {
	                        BipClient.growl(resp.message, 'error');
	                      } else {
	                        BipClient.growl('An Error Occurred', 'error');
	                      }
	                    }
	                  }
	                });
	            }
	          }
        }
      },

      remove : function(e) {
        var self = this;
        e.stopPropagation();
        e.preventDefault();
        $('#channel-delete-dialog').modal('hide');
        this.model.destroy({
          success : function(model, response) {
            BipClient.growl('Action <strong>' + self.model.get('name') + '</strong> Deleted');
            self._router.navigate('pods', true);
            self.reset();
          },
          error : function(model, response) {
            var message = 'An Error Occorred';
            if (409 === response.status) {
              message = "<strong>" + model.get('name') + "</strong> is in use";
            }

            BipClient.growl(message, 'error');
          },
          wait : true
        });
      },

      renderRow : function(pod, appendTo) {
        var struct = pod.toJSON(), html;
        struct.auth_status_class = (struct.auth.status == 'accepted') ? 'alert-info' : '';
        if (!struct.level_locked) {
          struct.level_locked = false;
        }
        appendTo.append(this.tplPodEntity(struct));
      },

      // deprecated
      reauthPod : function(ev) {
        var $src = $(ev.currentTarget),
          podName = $src.attr('data-pod'),
          model = BipClient.getCollection('pod').get(podName);

       if (model) {
         ev.preventDefault();
         ev.stopPropagation();
         this._authModalSpawn(model, true);
       }
      },

      authModal : function(ev) {
        var $src = $(ev.currentTarget),
          podName = $src.attr('data-pod'),
          model = BipClient.getCollection('pod').get(podName);

       if (model) {
         ev.preventDefault();
         ev.stopPropagation();
         this._authModalSpawn(model, 'accepted' === model.get('auth').status);
       }
      },

      _authModalSpawn : function(model, reauth, modalId) {
        if (!modalId) var modalId = '#authModal';
        var modal = $(modalId),
          modalContainer,
          modelJSON = model.toJSON(),
          podAuth = modelJSON.auth,
          self = this;

          modelJSON.reauth = reauth;

          if ('issuer_token' === podAuth.strategy) {
            var entities = [];
            for (var k in podAuth.properties) {
              if (podAuth.properties.hasOwnProperty(k)) {
                entities.push(podAuth.properties[k].title);

                // interpolate links in description
                if (podAuth.properties[k].description) {

                  var $description = $('<span>' + podAuth.properties[k].description + '</span>'),
                    $links = $('a', $description);

                  _.each($links, function(link) {
                    $(link).attr('target', '_blank');
                  });

                  podAuth.properties[k].description = $description.html();

                }
              }
            }

            modelJSON.authEntities = '<strong>' + entities.join('</strong> and <strong>') + '</strong>';
          } else if ('oauth' === podAuth.strategy && podAuth.scopes.length) {
            var normedScopes = [];
            for (var a = 0; a < podAuth.scopes.length; a++) {
              normedScopes.push(podAuth.scopes[a].replace(/.*\/(.*)$/, '$1'));
            }
            podAuth.scopes = normedScopes;
          }

          modal.html(this.tplModal(modelJSON));

          modalContainer = $('.modal-overlay', modal);

          // no router, drop continue button
          if (!self._router) {
            $('.modal-continue', modalContainer).remove();
          }

          $('.modal-continue', modalContainer).click(function(ev) {
            ev.preventDefault();

            modalContainer.hide();

            if (self._router) {
              self._router.navigate('pods/pod/' + model.id + '/browse', { trigger : true });
            }
          });

          $('.modal-authenticate', modalContainer).click(function(ev) {
            ev.preventDefault();
            var formVars = $('.modal-authenticate').closest('.modal').find('form').serializeArray();
            self.verify(ev, false, formVars, model );
          });

          $('.modal-deauth', modalContainer).click(function() {
            self.deAuthorize.apply(self, arguments);
          });

          $('.modal-close').on('click', function(ev) {
            ev.preventDefault();
            if (!modelJSON.reauth && self._router) {
              self._router.navigate('pods');
            }
            self.trigger('pod:authCancel');
            modalContainer.hide();
          });

          $('.modal-overlay', modal).show()

          $('i', modal).popover();

          BipClient.centerModal($('.modal', modal));
      },

      // if pod isn't available then spawn modal, otherwise pass through to
      // channel setup
      //if we pass bip_model then we are editing our pod
      podSelect : function(model, browse, bip_model) {
        var self = this;

        if (model.get('auth').status == 'accepted' || model.get('auth') == 'none') {
            self._renderChannel(BipClient.getCollection('channel').newModel(),  model);

        } else if (browse) {
          self._renderChannel(BipClient.getCollection('channel').newModel(), model, undefined, true);

        } else {
          this._authModalSpawn(model);
        }
      },

      updateRow : function(domain) {
        var innerHTML = $('.well', this.renderRow(domain));
        $('#domain-entity-' + domain.id).html(innerHTML);
      },

      _credentialError : function(error, name, message) {
        var el = $('#authModal #' + name),
        ctl = el.closest('.control-group'),
        helper = ctl.find('.help-block');

        helper.html(message);
        if (error) {
          ctl.addClass('error');
        } else {
          ctl.removeClass('error');
        }
      },

      verifyIssuerToken : function(formVars) {
        var self = this,
          userCtl = $('#authModal #username'),
          passwordCtl = $('#authModal #password'),
          keyCtl = $('#authModal #key'),
          err = false,
          username, password, key;

        _.each(formVars, function(v) {
          if ('username' === v.name) {
            self._credentialError(false, 'username');
            if (v.value && '' !== v.value) {
              username = v.value;
            } else {
              self._credentialError(true, 'username', 'required');
              err = true;
            }
          } else if ('password' === v.name) {
            self._credentialError(false, 'password');
            if (v.value && '' !== v.value) {
              password = v.value;
            } else {
              self._credentialError(true, 'password', 'required');
              err = true;
            }
          } else if ('key' === v.name) {
            self._credentialError(false, 'key');
            if (v.value && '' !== v.value) {
              key = v.value;
            } else {
              self._credentialError(true, 'key', 'required');
              err = true;
            }
          }
        });

        if (err) {
          return;
        } else {
          return [ username, password, key ];
        }
      },

      _verifyHandler : function(podName) {
        if (this._router) {
          this._router.navigate('pods/pod/' + podName, { trigger : true });
        }

        this.trigger('pod:auth', podName);
      },

      verify : function(ev, noClose, formVars, model) {
        var $btn = $(ev.currentTarget),
          id = $btn.attr('data-model-id'),
          oAuthWindow,
          self = this, authType, url, username, password;

        model = model || this.collection.get(id);

        authType = model.get('auth').strategy,
        url = model.get('auth')._href;

        if ('issuer_token' === authType) {
          var tokens = self.verifyIssuerToken(formVars),
            username = tokens[0],
            password = tokens[1],
            key = tokens[2];

          if (!tokens) {
            return true;
          }
        }

        $btn.button('loading');

        if (model.get('auth').strategy === 'oauth') {
          oAuthWindow = window.open('', 'BipIO - Negotiating OAuth Token');
        }

        // ask who
        $.ajax('/auth/who', {
          'success' : (function(model, url, username, password) {
            return function(data, status, xhr) {
              var payload = $.parseJSON(data), authURL;

              if (model.get('auth').strategy === 'issuer_token') {
                var provider = model.get('name');
                $.ajax({
                  url : url,
                  type : 'GET',
                  data : {
                    username : username,
                    password : password,
                    key : key,
                  },
                  xhrFields: {
                      withCredentials: true
                   },
                  beforeSend: function (xhr) {
                	  if (payload.api_token_web) {
	                      xhr.setRequestHeader("Authorization", "Basic " + payload.api_token_web);
	                      return xhr;
                      }
                  },
                  success : function() {
                    $btn.button('reset');
                    BipClient.growl(provider + ' pod enabled', 'success' );
                    BipClient.authStatusChange(provider, 'accepted');
                    self._verifyHandler(provider);
                  },
                  error : function(res, status, statusMsg) {
                    $btn.button('reset');
                    var err;
                    try {
                      err = JSON.parse(res.responseText);
                      if (err.message) {
                        err = err.message;
                      }
                    } catch (e) {
                    }

                    err = err || res.responseText || statusMsg;

                    BipClient.growl(BipClient.getCollection('pod').get(provider).get('title') + ' : ' + err, 'error' );
                  },
                  complete: function (data) {
                      if (!noClose) {
                          $('#authModal .modal-close').trigger('click');
                        }
                  }
                });
              } else {
                if (!noClose) {
                  $('#authModal .modal-close').trigger('click');
                }
                $btn.button('reset');
                // start oauth in new window
                //window.open(authURL, 'BipIO - Negotiating OAuth Token');
//                oAuthWindow.location.href = authURL;
                oAuthWindow.location.href = url;
              }
            }
          })(model, url, username, password)
        });
      },

      _deAuthHandler : function(podName) {
        if (this._router) {
          this._router.navigate('pods', { trigger : true });
        }
      },

      deAuthorize : function(ev) {
        ev.preventDefault();

        var $btn = $(ev.currentTarget),
        id = $btn.attr('data-model-id'),
        self = this, authType, url, username, password,
        model = this.collection.get(id);

        authType = model.get('auth').strategy,
        url = model.get('auth')._href;

        $btn.button('Forgetting...');

        if ('issuer_token' === authType) {
          url = url.replace(/set$/, 'deauth');
        } else if ('oauth' === authType) {
          url = url.replace(/auth$/, 'deauth');
        }

        $.ajax(
          url,
          {
            'success' : function() {
              BipClient.authStatusChange(model.get('name') , 'disabled');
              BipClient.growl(model.get('name') + ' pod disabled');

              $btn.button('reset');
              $('.modal-close').trigger('click');

              self._deAuthHandler(model.get('name'));
            },
            'error' : function() {
              $btn.button('reset');
              BipClient.growl('An Error Occurred', 'error' );
            }
          }
        );
      }
    });

    return PodListView;
  });
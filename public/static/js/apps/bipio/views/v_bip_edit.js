define([
    'underscore',
    'backbone',
    'bipclient',
    // app views
    'apps/bipio/views/v_bip_hub',
    'apps/bipio/views/v_bip_logs',
    'apps/bipio/views/v_req_parser',
    'apps/bipio/views/v_bip_data',
    'apps/bipio/views/channel/v_channel_list',
    'apps/bipio/views/v_bip_share',
    'apps/bipio/views/v_bip_transform',
    'apps/bipio/views/v_bip_trigger',
    'apps/bipio/views/v_auth',
    // pod app views
    'apps/pods/views/v_channel_pod_list',
    'apps/pods/views/v_channel_config',
    'apps/pods/views/v_channel_renderers'
  ],
  function(
      _,
      Backbone,
      BipClient,
      // app views
      HubView,
      BipLogsView,
      ParserView,
      DataView,
      ChannelListView,
      BipShareView,
      TransformView,
      TriggerView,
      AuthView,
      // pod app views
      PodListView,
      ChannelConfigView,
      RenderersView) {

    BipEditView = Backbone.View.extend({
      // dom
      el: '#bip-setup',
      $controlPane : null,
      $controlModal : null,
      $controlModalContent : null,

      // templates
      tplBipConfig: _.template($('#tpl-bipio-select').html()),
      tplLoader :  _.template($('#tpl-loader').html()),
      tplInfoPod : _.template($('#tpl-bipio-pod-info').html()),
      tplPodEntity : _.template($('#tpl-bipio-pod-entity').html()),
      tplPodSelectModal : _.template($('#tpl-bipio-modal-pod-select').html()),

      // control panes
      tplCtlStart : _.template($('#tpl-bipio-hub-start').html()), // start pane
      tplCtlChanSelect : _.template($('#tpl-bipio-channel-select').html()), // channel select
      tplCtlPodSelect : _.template($('#tpl-bipio-pod-select').html()), // pod select
      tplCtlChanCreate : _.template($('#tpl-bipio-channel-create').html()), // action select
      tplCtlTransform : _.template($('#tpl-bipio-transform').html()), // transform select
      tplCtlEdge : _.template($('#tpl-bipio-edge').html()), // edge select

      // views
      hubView : null,
      logsView : null,
      _podView : null,
      _transformView : null,
      _triggerView : null,
      _channelListView : null,
      _authView : null,

      // state
      modalOpen : false,
      mode : null,
      waiting : false, // waiting for action
      modalWrapperPos: {},
      channelFilter : [],
      _openTime : null, // unix time edit was opened
      _activeShareID : null,

      // node pointers
      _activeCID : null, // active channel id
      _activeParentCID : null, // active parent
      _activeParentCIDSource : false, // active parent is 'source'

      events: {
        "click #bip-submit-close" : "publish",
        "click #bip-submit" : "publish",
        "click .delete-action" : "deleteBip",
        'keyup #bip_name' : 'reprUpdate',
        'click #bip-cancel' : 'modalClose',
        'unfocus #bip-name' : 'nameChanged',
        'click .pause-action' : 'pauseAction',
        'click .share-action' : 'shareAction',
        'click .trigger-action' : 'triggerAction',
        'click #repr-toggle' : 'toggleRepr',
        'click .clear-log-action' : 'clearLogs',
        'click .refresh-log-action' : 'refreshLogs',
        'click .description-action' : function() {
          setTimeout(function() {
            $('#bipio-desc-modal .modal-body textarea').focus()
          }, 500)
        },
        'click #bip-repr' : BipClient.selectContents
      },

      initialize:function (router) {
        var self = this;

        _.bindAll(
          this,
          'render',
          'shutdown',
          'publish',
          'deleteBip',
          'reprUpdate',
          'nameChanged',
          'modalClose',
          'closeRefresh',
          'clearErrorClasses',
          'invalidModel',
          'errTranslate',
          'pauseAction',
          'pauseBip',
          'toggleAuth',

          'clearLogs',
          'refreshLogs',
          'setTrigger',
          'toggleRepr',

          '_addChannel',

          '_renderBip',
          '_renderDefault',
          '_bindModalEvents',
          '_setupValidation',
          '_modalResize',

          // control modal content
          '_setControlModalContent',

          // control pane binding
          '_initControlPane',             // setup control pane events
          '_controlPaneRest',             // resting edit view (no modals or context)
          '_controlPaneChanSelect',       // Channel Metadata view
          '_controlPanePodSelect',        // Pod Search view
          '_controlPaneChanCreate',       // Channel create / Pod Auth
          '_controlPaneChanTransform',    // Transforms view handler
          '_controlPaneConfigureTrigger'  // Trigger config view handler
        );

        this._router = router;

        this.deleteModal = $('#bipio-delete-modal');
      },

      _enableOptions : function() {
        $('#edit-options').removeClass('hide');
      },

      // in an evet source wait state
      _isWaiting : function() {
        return (this.model
          && 'trigger' === this.model.get('type')
          && !Object.keys(this.model.get('config')).length
        );
      },

      render : function(id, mode, struct) {
        var self = this;

        // add # bips constraint
        if ( ('new' === id || 'dup' === mode || 'shared' === mode) && BipClient.bipsExceedPlan()) {
          self._router.navigate(
            'bipio',
            {
              trigger : true
            }
          );

          BipClient.selectPlanRoute('num_bips');
          return;
        }

        this._openTime = moment().unix();

        this.channelFilter = [];

        this.mode = mode;

        if (id && id !== 'new' && mode !== 'shared') {
          this.model = BipClient.getCollection('bip').factoryClone(id);

          // duplicate
          if (mode === 'dup') {
            var modelJSON = this.model.toJSON();

            delete modelJSON.id;
            modelJSON.name += ' - copy';
            modelJSON.dup = true;


            modelJSON.paused = false;

            // strip metas
            for (var k in modelJSON) {
              if (0 === k.indexOf('_')) {
                delete modelJSON[k];
              }
            }

            this.model = BipClient.getCollection('bip').factory(modelJSON);
          }

          if (this.model) {
            if ('delete' === mode) {
              this.deleteBip();
            } else {
              this._renderBip(false, false, mode);
            }
          } else {
            this.model = BipClient.getCollection('bip').factory({
              id : id
            });

            this.model.fetch({
              success : function(model) {
                self.model = model;
                self._renderBip();
              },
              error : function() {
                BipClient.growl('Bip Does Not Exist', 'error');
              }
            });
          }

        } else if ('shared' === mode) {
          var bipStruct = BipClient.activeShare;
          if (!bipStruct) {
            BipClient.growl('No Community Bip Selected', 'error');
            self._router.navigate('bipio', { trigger : true });
            return;
          } else {
            bipStruct.domain_id = userSettings.bip_domain_id;
            this.model = BipClient.getCollection('bip').factory(bipStruct);
            this._renderBip(true);
            this._activeShareID = struct;
            BipClient.growl('Please Confirm Settings Before Saving');
          }
        }  else {
        	  if('http' === mode && 'new' === id && struct) {
             	 	var schema = BipClient.getCollection('pod').getActionSchema( struct ),
                   podName = struct.split('.')[0];

      	       	 if(schema && schema.trigger === 'http') {
      	       	        // create bip with default settings
      	       	        var data = {
      	       	          type : mode,
      	       	          domain_id : userSettings.bip_domain_id,
      	       	          config : {
                            channel_id : struct
                          },
                          name : struct.replace(/\.|_/g, '-'),
                          note : schema.description
      	       	        };

                        if (schema.exports && schema.exports.properties) {
                          data.exports = schema.exports;
                        }

      	       	        this.model = BipClient.getCollection('bip').factoryDefault(data);
      	       	        this._renderBip();
                 //
      	       	 } else {
                   this._renderDefault(mode, struct);
                 }
             } else {
            	 this._renderDefault(mode);
             }
        }

        $('#hub').droppable({
          accept : '.channel-list-item',
          drop : function(ev, ui) {
            var cid = $('a', ui.draggable).attr('data-channel-id'), // deprecated
              action = $('a', ui.draggable).attr('data-action'),
              offs = $(this).offset(),
              x = ui.offset.left - offs.left
              y = ui.offset.top - offs.top;

            //set dragging flag to false when dropping
            self.itemDragged=false;

            ui.draggable.remove();
            self._addChannel(action, ev, x, y);
          }
        });

        $('#repr-toggle').tooltip();
        this._setupValidation();

        $('#hub').click(function(){
          if( $('#collapseContent').hasClass('in') ){
            $('#collapseContent').collapse('hide');
          }
        });

        self.listenTo(self.model, 'channel:invalid', this.triggerInvalidChannel);
        this.hubView.on('loadPods', this.loadPods, this);
      },

      triggerInvalidChannel: function(cid, err){
        this.hubView.trigger("channel:invalid", cid, err);
      },

      shutdown : function() {
        this.undelegateEvents();

        this.$el.removeData().unbind();
        this.$el.remove();

        // Remove view from DOM
        this.remove();
        Backbone.View.prototype.remove.call(this);

        $(window).off("resize orientationchange", this._resize);

        if (this.hubView) {
          this.hubView.shutdown();

          this.hubView.undelegateEvents();

          this.hubView.$el.removeData().unbind();
          this.hubView.$el.remove();

          // Remove view from DOM
          this.hubView.remove();
          Backbone.View.prototype.remove.call(this.hubView);
        }
      },

      // applies responsive bootstrap grid dimensions to
      // control pane modals
      _modalResize : function() {
        var $ctlPaneWidth = $('#channel-connect').width(),
          newHeight;

        $('#hub').height(newHeight);

        newHeight = this.hubView._setDimensions()[1];

        $('#channel-connect').height(newHeight);

        // set tab heights
        $('.tab-pane').height($('#hub').height() + 10);

        $('#config-modal .modal', this.$el)
          .css('height', newHeight )
          .css('left', $ctlPaneWidth + 30) // +30 for bootstrap span class margin
          .css('width', $('#bipio-container').width() - $ctlPaneWidth);
      },

      _toggleOverlay : function(show) {
        var $el = $('#blocking-overlay');

        if (show) {
          $el.addClass('hide');
        } else {
          $el.removeClass('hide');
        }
      },

      _renderDefault : function(mode, defaultName) {
        // create bip with default settings
        var data = {
          type : mode,
          domain_id : userSettings.bip_domain_id
        };
        this.model = BipClient.getCollection('bip').factoryDefault(data);
        if (defaultName) {
          this.model.set('name', defaultName);
        }
        this._renderBip();
      },

      _renderBip: function(sharedCreation, modalSelect, mode) {
        var dict = this.model.toJSON(),
        el = $(this.el),
        endLife = this.model.get('end_life'),
        expireTime,
        type = dict.type,
        self = this;

        dict.shared = sharedCreation;
        dict.isNew = (undefined == this.model.id);

        this.isNewTrigger = this.model.isNew() && 'trigger' === this.model.get('type') && 'dup' !== mode && !sharedCreation;

        if (!dict._repr) {
          dict._repr = '';
        }

        if (!dict.app_id) {
          dict.app_id = '';
        }

        // apply end_life account default
        if (dict.isNew) {
          dict.end_life = _.clone(userSettings.bip_end_life);
        }

        // apply default behavior if none set
        if (!dict.end_life.action || '' === dict.end_life.action) {
          dict.end_life.action = userSettings.bip_expire_behaviour;
        }

        dict.domainCollection = BipClient.getCollection('domain').toJSON();

        // translate expiry to something UI friendly
        dict.expiry_imp = parseInt(endLife.imp);
        if (isNaN(dict.expiry_imp) || dict.expiry_imp == 0) {
          dict.expiry_imp = '';
        }

        dict.explicitDate = false;
        dict.time_zone = userSettings.timezone;

        dict.expiry_time_period = '';
        if (endLife.time != 0 && endLife.time != '') {
          // if its an account default calculation
          if (endLife.time.match) {

            var timeTokens = endLife.time.match(/(\d+)(d|m|y)/);
            // ghetto
            if (timeTokens && timeTokens[1] && timeTokens[2]) {
              dict.expiry_time = timeTokens[1];
              dict.expiry_time_period = timeTokens[2];
            } else {
              dict.expiry_time = endLife.time;
            // else what?
            }
          // otherwise it has been translated to a date
          } else {
            dict.explicitDate = true;
            //var expireDate = new Date(endLife.time * 1000);
            //dict.expiry_time = expireDate.toString('dd-MM-yyyy');
            dict.expiry_time = moment(endLife.time * 1000).format('MM/DD/YYYY');
          }
        } else {
          dict.expiry_time = '';
        }

        dict.icon = this.model.getIcon();
        dict.iconURL = dict.icon;
        if (0 === dict.iconURL.indexOf('/') ) {
          dict.iconURL = '';
        }

        dict.trigger = null;
        dict.pod = null;

        if (dict.type == 'trigger' ) {
          var preamble = 'Trigger Bips fire when a Channel generates an event';
          if (!dict.shared && dict.isNew && !modalSelect) {
            dict.isNewTrigger = true;
          } else {
            dict.isNewTrigger = false;

            // attach trigger and pod to template
            var channel = BipClient.getCollection('channel').get(dict.config.channel_id);
            dict.trigger = channel.toJSON();
            dict.pod = channel.getPod().toJSON();
          }
        } else {
        	 if(dict.config.channel_id) {
        		 var channel = BipClient.getCollection('channel').get(dict.config.channel_id);
        		 dict.pod = channel.getPod().toJSON()
        	 }
        }

        if ('refresh' === mode) {
          var $hub = $('#hub');
        }

        el.html(self.tplBipConfig(dict));

        if ('refresh' === mode) {
          $('#hub').replaceWith($hub);
          self.hubView.addFunctionWidget(true);
        }

        //get the initial top and left of #modall-wrapper in order to set them back after the modal dialog is closed in case it was dragged to another position.
        this.modalWrapperPos =  $('#modal-wrapper').offset();

        // explicitly set popover
        $('.map-action h3 small i').popover();

        // --------------- HUB VIEW

        // pass a shallow copy of the bip source into the hub view
        if ('refresh' !== mode) {
          self.hubView = new HubView(self.model);

          self.hubView.on('keyEvent', function(ev) {
            // ctrl+a adds an action or event
            if (ev.keyCode === 65 && ev.ctrlKey) {
              $('#link-channel-create').click()
            }
          });

          if (dict.hub) {
            self.hubView.render(dict.hub);
          }
        }

        // general decorators
        if (!dict.isNew) {

          $('#bip_expiry_date_control').datepicker(
            {
              date : dict.expiry_time ? dict.expiry_time : null
            }
          );

          // --------------- DATA VIEW
          // start data view
          var dataView = new DataView(
            $('#bip-config-tabs', this.$el),
            $('.tab-content', this.$el)
          );
          dataView.render(this.model);
          /*
          // disabled, needs investigation. change doesn't trigger on nested object value changes
          this.model.on('change', function(model) {
            dataView.render(model);
          });
*/
        }

        if ('http' === type ) {
          // --------------- PARSER VIEW
          if (ParserView.test()) {
            // start parser view
            var parserView = new ParserView(
              {
                tabContainer : $('#bip-config-tabs', this.$el),
                contentContainer : $('.tab-content', this.$el)
              }
            );

            parserView.render(dict.exports);

            parserView.on('schema:imported', function(schema) {
              self.model.set('exports', schema);
            });
          }

          // --------------- AUTH VIEW
          // start data view
          this._authView = new AuthView(
            $('#bip-config-tabs', this.$el),
            $('.tab-content', this.$el),
            this.model
          );
          this._authView.render();
        }

        // --------------- RENDERERS VIEW
        // setup renderers pane
        this.renderersView = new RenderersView('#renderers-panel', '#bip-render-panel');
        this.renderersView.on('renderer:add', function(renderer) {
          var config = self.model.get('config');
          delete config.renderer;

          config.renderer = _.clone(renderer);
        });

        this.renderersView.on('renderer:remove', function() {
          var config = self.model.get('config');
          delete config.renderer;
        });

        // --------------- GENERAL SETUP

        // display tabs
        $('#bip-config-tabs a').click(function (e) {
          e.preventDefault();

          $(this).tab().on('shown', function(e) {
            if (e.target.hash === '#bip-logs-panel') {
              var target = $('#log-body', e.target.hash);

              // load the log
              if (!target.html()) {
                target.append($('.roto', self.tplLoader()));
                self.logsView = new BipLogsView(self.model.id);
              }
            }
          }).tab('show');
        });

        $('#bip-config-tabs a[href="#bip-' + mode + '-panel"]').trigger('click');

        $('.tooltipped').tooltip();

        var schedule = _.clone(self.model.get('schedule')),
          plan = BipClient.getUserPlan();;

        // set default system schedule of 15 minutely
        if (!schedule || !Object.keys(schedule).length) {
          // assume there's no plan for the mount and
          // set default recur pattern
          schedule = {
            recurrencePattern : 'FREQ=MINUTELY;INTERVAL=5;'
          };

          // inject plan parameters
          if (plan && plan.schedule && plan.schedule.recurrencePattern) {
            schedule.recurrencePattern = plan.schedule.recurrencePattern;
          }
        }

        $('#bip-schedule').scheduler('value', schedule);

        // toggle 'repeat' option with upgrade messaging
        if (plan && plan.schedule) {
          $('.scheduler-upgrade').show();
          $('.scheduler-repeat').hide();
          $('.scheduler-upgrade button').on('click', function() {
            BipClient.selectPlanRoute('schedule');
          })
        } else {
          $('.scheduler-upgrade').hide();
          $('.scheduler-repeat').show();
        }

        // description modal
        $('#bipio-desc-modal').on('shown', function() {
          BipClient.centerModal($('.modal', this));
        });

        // icon modal
        $('#bipio-icon-modal').on('shown', function() {
          BipClient.centerModal($('.modal', this));
        });

        $('#bipio-icon-modal').on('hide', function() {
          var iconURL = $('input', this).val();
          if ('' !== iconURL && !/https?:\/\//.test(iconURL)) {
            BipClient.growl('Not A Valid Icon URL', 'error');
            return false;
          } else {

            if ('' === iconURL)  {
              self.model.set('icon', '');
            } else {
              self.model.set('icon', iconURL);
            }

            self.hubView.bindBipSourceIcon(self.model.getIcon());

            $('img', this).attr('src', self.model.getIcon());
          }
        });

        // do not show expiry&schedule options
        if (this.isNewTrigger) {
          $('#tab-schedule,#tab-expiry').hide();
        }

        this._refreshRenderers();

        this.model.on('validated:invalid', this.invalidModel, this);
        this.model.on('validated:valid', this.clearErrorClasses, this);

        Backbone.Validation.bind(this);

        this.$controlPane = $('#control-pane', this.$el);
        this.$controlModal = $('#config-modal', this.$el);
        this.$controlModalContent = $('.modal-content', this.$controlModal);

        // setup Transform View
        this._transformView = new TransformView(this.model, this.$controlModalContent);
        this._transformView.sinceTime = this._openTime;
        this._transformView
          .on('meta:refresh', function(channelJSON) {
            self.$controlPane.html(self.tplCtlTransform(channelJSON));
          })
          .on('channel:valid', function(cid) {
            self.hubView.trigger("channel:valid", cid);
          })
          .on('channel:invalid', function(cid, message) {
            self.hubView.trigger("channel:invalid", cid , message);
          })
          .on('transform:invalid', function(cid, message) {
            $('#tab-home').click();
          });

        // setup trigger view
        this._triggerView = new TriggerView(this.model, this.$controlModalContent);
        this._triggerView.sinceTime = this._openTime;
        this._triggerView
          .on('meta:refresh', function(channelJSON) {
            self.$controlPane.html(self.tplCtlTransform(channelJSON));
          })
          .on('channel:set', function(cid) {
            self.setTrigger(cid || self._activeCID);        // new event select, prompt for next step

            if (!self.model.get('hub').source.edges.length) {
              BipClient.growl('Event Source Selected, Add Some Actions!');
            }
          });

        self._activeParentCID = null;
        self._activeCID = null;
        self._activeParentCIDSource = false;

        // initialize control pane
        this._initControlPane(dict);

        this.listenTo(this.model, 'channel:invalid', this.triggerInvalidChannel);

        // show options if not in a trigger wait state
        if (!this._isWaiting()) {
          this._enableOptions();
        }

        // highlight logs tab if recent errors
        if (_.findWhere(this.model.get('_links'), {name : 'errors'})) {
          $('#bip-config-tabs li a[href="#bip-logs-panel"]').addClass('tab-error');
        }

        // capture resizes for modals
        $(window).on('resize orientationchange', this._modalResize);

        this._modalResize();

        return this;
      },

      clearLogs : function(ev) {
        BipClient.getCollection('bip_log').clear(this.logsView.render);
      },

      refreshLogs : function(ev) {
        var $btn = $(ev.currentTarget),
          self = this;

        $btn.button('loading');

        this.logsView.$el.append($('.roto', self.tplLoader()));

        this.logsView.refresh(function() {
          $btn.button('reset');
        });
      },

      // ------------------------------- CONTROL PANE HANDLERS

      _containerFade : function($el, onFade) {

        $el.fadeOut(100, function() {
          onFade();
          $el.fadeIn(50);
        });
      },

      _setControlModalContent : function(html) {
        var self = this;

        $('.modal', this.$controlModal).html(html);

        $('.modal-close', this.$controlModal).on('click', function() {
          self.hubView.trigger('channel:cancel');
          self._controlPaneRest(true);
        });

        //remove window scrollbar
        $("body").css("overflow", "hidden");
        this.minimizeModal();
        this.changeZIndex($("#channel-connect")[0], 750)
        window.scrollTo(0,0);
        this.$controlModal.show();
        this.modalOpen = true;
      },

      _setControlModalBody : function(html) {
        $('.modal-body', this.$controlModal).html(html);
      },

      _setControlModalFooter : function(html) {
        $('.modal-footer', this.$controlModal).html(html);
      },

      _addChannel : function(cid, mouseEv, x, y) {
        var self = this,
          x = x || 32,
          y = y || (mouseEv ? mouseEv.clientY - $('svg').position().top - 24 : 0);

        if ('trigger' === self.model.get('type') && !self.model.get('config').channel_id) {
          self.setTrigger(cid);
        } else {
          var channelJSON = BipClient.getCollection('channel').get(cid).toJSON();

          self.hubView.addChannel(channelJSON.id, x, y);

          self.channelFilter.push(channelJSON.id);
          self._controlPaneRest(true);
        }
      },

      _refreshRenderers : function() {
        // rebuild renderers
        var renderer = {};

        if ('http' === this.model.get('type') && this.model.get('config').renderer) {
          renderer = this.model.get('config').renderer;
        }

        this.renderersView.render(renderer);
      },

      // setup control pane and events
      _initControlPane : function() {
        var self = this;

        //
        $('.modal-content', this.$controlModal).height($('#hub').height());

        $('#modal-wrapper').draggable({ handle: ".modal-header" });

        this._controlPaneRest();
        //
        self.hubView.on('select:cid', function(channelId, parentChannelId, isParentSource) {
          self._activeParentCID = parentChannelId;

          self._activeCID = channelId;
          self._activeParentCIDSource = isParentSource;

          // adding a new channel
          if (!channelId) {
            self._controlPaneChanSelect();
          // transforming existing channel
          } else {

          }
        });

        self.hubView.on('transform:cid', function(channelId, parentChannelId, isParentSource) {
          var channel = BipClient.getCollection('channel').get(channelId);

          // if channel has imports, then spawn transform
          if (channel.hasImports()) {
            self._activeParentCID = parentChannelId;

            self._activeParentCIDSource = isParentSource;

            self._activeCID = channelId;
            self._controlPaneChanTransform();
          } else {
            BipClient.growl('Action Has No Attributes To Personalize');
          }
        });

        self.hubView.on('trigger:configure', function(channelId) {
          var channel = BipClient.getCollection('channel').get(channelId);

          // if channel has imports, then spawn transform
          if (channel.getPod().hasConfig(channel.get('action'))) {
            self._activeCID = channelId;
            self._controlPaneConfigureTrigger();

          } else {
            BipClient.growl('Action Has No Attributes To Personalize');
          }
        });

        // setup edge hover binding
        self.hubView.on('edge:hover', function(sourceCId , targetCId) {
            //disable hover when dragging
            if(!self.itemDragged){
              var sourceChannelJSON = self._transformView.getChannelDict(sourceCId),
                targetChannelJSON = self._transformView.getChannelDict(targetCId);

              self._containerFade(self.$controlPane, function() {
                $("#channel-connect" ).addClass( "edge-connect" );
                self.$controlPane.html(
                  self.tplCtlEdge(
                    {
                      source : sourceChannelJSON,
                      target : targetChannelJSON
                    }
                  )
                );
              });
            }

        });
        // setup edge dehover binding
        self.hubView.on('edge:dehover', function() {
          //disable dehover when dragging
          if(!self.itemDragged){
            if (!self.modalOpen) {
              self._containerFade(self.$controlPane, function() {
                $("#channel-connect" ).removeClass( "edge-connect" );
                self._controlPaneChanSelect();
              });
              self.hubView.refocus();
            }
          }
        });

        self.hubView.on('transform:hint', self._transformView.transformHint);

        // setup channel hover binding
        self.hubView.on('channel:hover', function(channelId, hasParent) {
            //disable hover when dragging
            if(!self.itemDragged){
              var channel = BipClient.getCollection('channel').get(channelId);

              var channelJSON = self._transformView.getChannelDict(channelId);

              if (channel) {
                channelJSON.icon = channel.getIcon();
              } else {
                channelJSON.icon = channelJSON.pod.icon;
              }

              if (channelId && 'trigger' !== channelId) {
                channelJSON._hover = 'drag';
                if (hasParent && channel.hasImports() ) {
                  channelJSON._hover = 'click'
                }
              //} else if ('trigger' === channelId) {
              //  channelJSON._hover = 'click'
              }

              channelJSON.isNewTrigger = self.isNewTrigger;

              self._containerFade(self.$controlPane, function() {
                self.$controlPane.html(self.tplCtlTransform(channelJSON));
              });
            }
        });

        // setup channel hover binding
        self.hubView.on('channel:dehover', function() {
          //disable dehover when dragging
          if(!self.itemDragged){
            if (!self.modalOpen) {
              self._containerFade(self.$controlPane, function() {
                $("#channel-connect" ).removeClass( "edge-connect" );
                self._controlPaneChanSelect();
              });

              self.hubView.refocus();
            }
          }
        });

        self.hubView.on('channel:remove', function(cid) {
          self.model.removeEdge(cid);

          self.channelFilter = _.difference(self.channelFilter, [ cid ]);
          self._controlPaneRest(true);
        });
      },

      // when at rest
      _controlPaneRest : function(hubFocus) {
        this._controlPaneChanSelect();

        this.changeZIndex($("#channel-connect")[0], 0)
        //show window scrollbar if needed
        $("body").css("overflow", "auto");
        //return #modal-wrapper to its initial position - usefull if the modal dialog has been dragged to another position
        $('#modal-wrapper')[0].style.position = "relative";
        //$('#modal-wrapper').offset({top: this.modalWrapperPos.top, left: this.modalWrapperPos.left})
        $('#modal-wrapper').css({top: this.modalWrapperPos.top, left: 0 });
        this.minimizeModal();

        this.$controlModal.hide();

        this._toggleOverlay(true);

        this.hubView.refocus();
        $('#hub svg rect').trigger('mouseup');

        this.modalOpen = false;
      },

      // when selecting a channel
      _controlPaneChanSelect : function(cid, parentCID) {
        var self = this,
          hub = this.model.get('hub');

        //item draggable flag we set it to true when an item is currently dragged
        self.itemDragged = false;

        // create channel filter

        for (var cid in hub) {
          this.channelFilter.push(cid);
          for (var i = 0; i < hub[cid].edges.length; i++) {
            this.channelFilter.push(hub[cid].edges[i]);
          }
        }

        this.channelFilter = $.unique(this.channelFilter);

        // set template
        this.$controlPane.html(this.tplCtlChanSelect(
          {
            emitter : this.isNewTrigger,
            waiting : !this.channelFilter.slice(1).length,
//            sourceConnections : this.hubView._links.length
            sourceConnections : true // @tood
          })
        );

        if (!this._channelListView) {
          this._channelListView = channelList = new ChannelListView(
            self.$controlPane, // container
            '.ag-list-results', // target subcontainer
            this.isNewTrigger ? 'emitters' : 'actions',
            this.channelFilter // exclusions
          );

          this._channelListView .on('view:rendered', function() {
            $('.channel-list-item').draggable({
              containment : '.map-action',
              appendTo : 'body',
              cursorAt: {
                top: 0,
                left: 0
              },
              drag: function(event, ui) {
                //set flag to true when dragging
                self.itemDragged=true;
              },
              helper : function() {
                return $('img', arguments[0].currentTarget).clone().css('z-index', 1000);
              },
            });

            $('.channel-list-item')
              .on('mouseover', function() {
                $('button', this).css('right', '0px');
              })
              .on('mouseout', function() {
                $('button', this).css('right', '-65px');
              })
              .on('dblclick', function(ev) {
                var cid = $(this).children('a').attr('data-channel-id'),
                  action = $(this).children('a').attr('data-action');

                cid = cid || action;

                if (cid) {
                  self._addChannel(cid, ev);
                }
              });

/*
            $('.channel-list-item button').one('click', function(ev) {
              var cid = $(this).siblings('a').attr('data-channel-id'),
                action = $(this).siblings('a').attr('data-action');

              cid = cid || action;

              if (cid) {
                self._addChannel(cid, ev);
              }

              return false;
            });
*/
          });

          this._channelListView.on('view:addAction', function(action) {
            var tokens = action.split('.'),
              pod = BipClient.getCollection('pod').get(tokens[0]);

            //if (pod && pod.isAuthed()) {
            //  self._controlPanePodSelect(pod, tokens[1]);

            //} else {
            if (pod && !pod.isAuthed()) {
              // spawn auth
              var podView = new PodListView();
              podView._authModalSpawn(pod);

              podView.on('pod:auth', function(podName) {
                self._controlPanePodSelect(pod, tokens[1]);
              });
            } else {
              self._addChannel(action);
            }
          });
        }

        this._channelListView.setSearchExclusions(this.channelFilter);

        this._channelListView.render(self.$controlPane);

        // set search from collection
        $('#channel-search-form').val(this._channelListView.collection.searchBy);

        // attach events
        $('#link-channel-create', self.$controlPane).on('click', function(ev) {
          ev.preventDefault();
          ev.stopPropagation();

          self._controlPanePodSelect();
        });

        $('#channel-search-form', this.$controlModal).focus();
      },

      loadPods: function(){
        this._controlPanePodSelect();
      },

      _controlPanePodSelect : function(pod, action, bip_model, isTrigger) {
        var self = this,
          renderPods;

        this._toggleOverlay();

        // set template
        this.$controlPane.html(this.tplCtlPodSelect({
          emitter : this.isNewTrigger
        }));

        // set modal
        this._setControlModalContent(this.tplPodSelectModal({ emitter : this.isNewTrigger }));

        // attach events
        $('#link-channel-search', self.$controlPane).on('click', function(ev) {
          ev.preventDefault();
          ev.stopPropagation();

          self._controlPaneRest();
        });

        // attach pods view
        var podView = new PodListView(null, null, this.isNewTrigger ? 'emitters' : 'actions');

        this._podView = podView;

        // inject alternate templates
        podView.tplActionSelect = _.template($('#tpl-bipio-action-select').html());

        podView._configView = new ChannelConfigView();
        podView._configView.tplActionEntity = _.template($('#tpl-bipio-action-entity').html());

        podView.on('podSelected', function(struct) {
          $('#config-modal h2').html( 'Select A ' +  struct.pod.get('title') + ' ' + (self.isNewTrigger ? 'Event' : 'Action') + ' Below');
        })

        podView.on('view:actionSelected', function(actionSchema, podName) {
          var channel = BipClient.find.channel(podName + '.' + actionSchema.name);

          // close modal
          self._controlPaneRest(true);

          if (self.isNewTrigger) {
            if(actionSchema.trigger === 'http') {
            	  self._router.navigate('bipio/new/http/' + podName + '.' + actionSchema.name, {trigger: true});
            	  return;
            }
            // if the channel has config, spawn the configurator
            if (channel.hasConfig()) {
              self.hubView.trigger('trigger:configure', channel.get('id'));
              return;
            } else {
              self.setTrigger(channel.get('id'));

              if (!self.model.get('hub').source.edges.length) {
                BipClient.growl('Event Source Selected, Add Some Actions!');
              }
            }
          } else {
            var channelJSON = channel.toJSON();
            self.hubView.addChannel(channelJSON.id);
          }

          self._enableOptions();
        });

        podView.on('view:cancel', function() {
          self._controlPaneRest(true);
        });

        podView.on('pod:deauth', function(podName) {
          if (_.findWhere(self.model.getManifest().normedManifest, {pod : podName})) {
            if (self.model.isValid(true)) {
              self.pauseBip('pause', 'Bip Has Disabled Services Integrated And Has Been Paused');
            }
          }
        });

        podView.on('pod:auth', function(podName) {
          var pod = BipClient.getCollection('pod').get(podName);

          self._controlPaneChanCreate(pod);
          podView.podSelect(pod, true);
        });

        function prependGenerateData(filter) {
          // prepend web hook and email bip types
          if (self.isNewTrigger) {
            var $el = $('#pod-list'),
              payloadStruct = {
                type : 'payload',
                title : 'Custom Event',
                icon : BipClient.getCollection('pod').get('flow').getIcon('generator')
              },
              noFilters = (!filter || !filter.length),
              payloadMatch=false;

            if (!noFilters) {
              _.each(filter, function(filter) {
                if (!payloadMatch && ( payloadStruct.type + payloadStruct.title).toLowerCase().match(filter) ) {
                  payloadMatch = true;
                }
              })
            }

            if (noFilters || payloadMatch) {
              $el.prepend(self.tplPodEntity(payloadStruct));
            }
          }
        }

        function prependAltBipTypes(filter) {
          var defaultName = $('#bip_name').val();
          // prepent web hook and email bip types
          if (self.isNewTrigger) {
            var $el = $('#pod-list'),
              emailStruct = {
                type : 'smtp',
                title : 'Incoming Email',
                icon : '/static/img/channels/32/color/bip_smtp.png',
                name : defaultName
              },
              httpStruct = {
                type : 'http',
                title : 'Incoming Web Hook',
                icon : '/static/img/channels/32/color/bip_http.png',
                name : defaultName
              },
              noFilters = (!filter || !filter.length),
              httpMatch = false,
              smtpMatch = false,
              bipTypes = BipClient.getCollection('bip_descriptions'),
              haveSmtp = bipTypes.get('smtp'),
              haveHTTP = bipTypes.get('http');

            if (!noFilters) {
              _.each(filter, function(filter) {
                if (haveHTTP && !httpMatch && ( httpStruct.type + httpStruct.title).toLowerCase().match(filter) ) {
                  httpMatch = true;
                }
                if (haveSmtp && !smtpMatch && ( emailStruct.type + emailStruct.title).toLowerCase().match(filter) ) {
                  smtpMatch = true;
                }
              })
            }

            if ( (noFilters && haveSmtp ) || smtpMatch) {
              $el.prepend(self.tplPodEntity(emailStruct));
            }

            if ( (noFilters && haveHTTP) || httpMatch) {
              $el.prepend(self.tplPodEntity(httpStruct));
            }
          }
        }

        // if we have a pod & action, nav straight into view
        if (pod) {

          podView._renderPods();

          // update view
          podView.podSelect(pod, true, bip_model);

          // propogate pod info to channel create pane
          //self._controlPaneChanCreate(pod);

          if (action) {
            if (pod.isAuthed()) {
              // select action
//              $('#action-' + pod.get('name') + '-' + action).trigger('click', isTrigger)

              // propogate pod info to channel create pane
//              self._controlPaneChanCreate(pod, action );
/*
              podView.trigger(
                'channel:saved',
                BipClient.find.channel(pod.get('name') + '.' + action)
              );
              */

              self.hubView.addChannel(pod.get('name') + '.' + action, 0, 0);

              //BipClient.find.channel(pod.get('name') + '.' + action)

            } else {
              self._controlPaneChanCreate(pod);
              $('#pod-auth').click();
            }
          } else {
            self._controlPaneChanCreate(pod);
          }

          podView.on('channel:saved', function(channel) {
            if (self.isNewTrigger) {
              self.setTrigger(channel.get('id'));

            } else {

              var channelJSON = channel.toJSON();
              self.hubView.addChannel(channelJSON.id, 0, 0);
              self.channelFilter.push(channelJSON.id);
            }

            // close modal
            self._controlPaneRest(true);

            self._refreshRenderers();
          });
          if(!isTrigger){
            self._controlPaneChanSelect();
            self._toggleOverlay(true);
          }

        } else {

          renderPods = function(filter) {
            podView._renderPods(undefined !== filter, filter);

            prependGenerateData(filter);

            $('#pod-list .pod-selector').on('click', function(ev) {
              var podName = $(ev.currentTarget).parent().parent().attr('data-pod'),
                pod = BipClient.getCollection('pod').get(podName);

              if (podName == "bip-payload") {
                self._controlPaneRest(true);

                self.setTrigger("flow.generator");

              } else {

                // check if pod is available and spawn
                // upgrade
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

                } else {
                  // update view
                  podView.podSelect(pod, true);

                  // propogate pod info to channel create pane
                  self._controlPaneChanCreate(pod);

                  if (!pod.isAuthed()) {
                    $('.action-selectable').addClass('browsing');
                    $('#pod-auth').click();
                  }
                }
              }

              return false;
            });

            // prepending here to skip the above ^^ click handler
            prependAltBipTypes(filter);

            //
            $('#pod-list .pod-selector').on('mouseover focus', function(ev) {
              var podName = $(ev.currentTarget).parent().parent().attr('data-pod'),
                pod,
                dict;

              // create a pseudo pod dict if it looks like a bip type hover
              if (0 === podName.indexOf('bip-')) {
                var bipType = podName.split('-').pop(),
                  description,
                  name,
                  icon;

                if ('http' === bipType) {
                  name = 'Incoming Web Hook';
                  description = 'Processes incoming HTTP requests to any of your domains';

                } else if ('smtp' === bipType) {
                  name = 'Incoming Email';
                  description = 'Processes incoming Emails to any of your domains';

                } else if ('payload' === bipType) {
                  name = 'Generate Data';
                  description = BipClient.getCollection('pod').get('flow').getAction('generator').description;
                  icon = BipClient.getCollection('pod').get('flow').getIcon('generator');
                }

                dict = {
                  ignore_auth : true,
                  pod : {
                    getIcon : function() {
                      return icon ? icon : '/static/img/channels/32/color/bip_' + bipType + '.png';
                    }
                  },
                  podJSON : {
                    name : name,
                    title : name,
                    description : description,
                    auth : {
                      status : 'accepted'
                    }
                  }
                };

              } else {
                pod = BipClient.getCollection('pod').get(podName),
                dict = {
                  ignore_auth : false,
                  pod : pod,
                  podJSON : pod.toJSON()
                };
              }

              dict.hover = true;

              $('.ctrl-panel-info', self.$controlPane).html(self.tplInfoPod(dict));

            }).on('mouseout', function() {
              $('.ctrl-panel-info', self.$controlPane).empty();
            });

            var idx = 0;

            $('#channel-search-form').attr('tabindex', idx);

            idx++;

            $('.channel-list-item a').each(function() {
              $(this).attr('tabindex', idx);
              idx++;
            });

          }

          $('#channel-search-form', this.$controlModal).on('keyup', function(ev) {

            if (ev.keyCode === 27) {
              self._controlPaneRest(true);
              return;
            }

            var searchStr = $(this).val(),
              podFilters = [],
              filters = _.map(searchStr.split(','), function(val) {
                return val.trim();
              });

            for (var i = 0; i < filters.length; i++) {
              if (filters[i]) {
                podFilters.push(filters[i]);
              }
            }

            renderPods(podFilters);
          });

          podView.on('channel:saved', function(channel) {
            if (self.isNewTrigger) {
              self.setTrigger(channel.get('id'));
            } else {
              var channelJSON = channel.toJSON();
              self.hubView.addChannel(channelJSON.id, 0, 0);
              self.channelFilter.push(channelJSON.id);
            }

            // close modal
            self._controlPaneRest(true);

            self._refreshRenderers();

          });

          renderPods();

          setTimeout(function() {
            $('#channel-search-form', this.$controlModal).focus()
          }, 200);
        }

        //
        $('.save-channel').click(podView.saveChannel);
      },

      // when creating a channel (pod selected)
      _controlPaneChanCreate : function(pod, action) {
        var self = this,
          dict = {
            ignore_auth : false,
            pod : pod,
            podJSON : pod.toJSON(),
            emitter : this.isNewTrigger,
            hover : false
          };

        this._toggleOverlay();

        // set template
        this.$controlPane.html(this.tplCtlChanCreate(dict));

        $('.ctrl-panel-info', this.$controlPane).html(self.tplInfoPod(dict));

        // attach events
        $('#link-pod-select', self.$controlPane).on('click', function(ev) {
          ev.preventDefault();
          ev.stopPropagation();

          var pod = BipClient.find.pod($(this).attr('data-pod'));
          self._controlPanePodSelect(pod);
        });

        var podView = new PodListView();
        $('#pod-auth', self.$controlPane).on('click', function() {
          podView.authModal.apply(this, arguments);

          self.modalOpen = true;
        });


        function cancelSelection() {
          $('#config-modal h2').html( 'Activate ' +  dict.pod.get('title') + ' And Access These Useful ' + (self.isNewTrigger ? 'Events' : 'Actions'));
        }

        podView.on('pod:authCancel', cancelSelection);
      },

      // ------------- TRANSFORMS HANDLER

      // ---------------------------- TRANSFORMS MODAL

      _setNodeTitle : function(title) {
        this.model.setTitleForCid(this._activeCID, title);
        $('#node-title-repr').html(title);
      },

      _toggleNodeEdit : function() {
        $repr = $('#node-title');
        $input = $('#node-title-edit');

        if ($repr.is(':visible')) {
          $repr.fadeOut(50, function() {
            $input.fadeIn(50, function() {
              $(this).focus();
            });
          });

        } else if ($input.is(':visible')) {
          $input.fadeOut(50, function() {
            $repr.fadeIn(50, function() {
              $(this).focus();
            });
          });
        }
        return false
      },

      _bindModalEvents : function() {
        var self = this;

        $("body").css("overflow", "hidden");

        // bind events
        $('#resizeModal','#modal-wrapper' ).click(function(e){
          if($(this).attr('class') == 'icon-resize-small'){
              self.minimizeModal()
            } else if($(this).attr('class') == 'icon-resize-full'){
              self.maximizeModal()
            }
        });

        $('.modal-close', this.$controlModalContent).on('click', function(ev) {
          ev.preventDefault();
          ev.stopPropagation();

          self._controlPaneRest(true);
        });

        $('.tooltippable', this.$controlModalContent).tooltip();
        $('.icon-question-sign').popover();

        // edge edit
        $('#node-title').on('click', this._toggleNodeEdit);

        $('#node-title-edit')
          .on('blur', function() {
            self._setNodeTitle($(this).val());
            $('#node-title').trigger('click');
          })
          .on('keyup', function(ev) {
            // enter
            if (13 === ev.keyCode) {
              $(this).blur();

            // esc
            } else if (27 === ev.keyCode) {
              $(this).val(
                self.model.getTitleForCid(self._activeCID)
              );
              $(this).blur();
            }
          });

        this.minimizeModal();
        this.changeZIndex($("#channel-connect")[0], 750)

        window.scrollTo(0,0);

        this.$controlModal.show();

        this.modalOpen = true;
      },

      // when adding a channel transform
      _controlPaneChanTransform : function() {
        var self = this,

          selectedCid = self._activeCID,
          channel = BipClient.getChannel(selectedCid),

          parentCid = self._activeParentCID,
          parentIsSource = self._activeParentCIDSource,

          parentCids = [ parentCid ].concat(this.hubView.getParentsForCID(parentCid));

       // -------------- RPCS

        this._toggleOverlay();

        // setup modal content
        this._transformView.render(
          selectedCid,
          parentCid,
          [ parentCid ].concat(this.hubView.getParentsForCID(parentCid)),
          parentIsSource
        );

        // -------- MODAL SETUP

        $('.modal-confirm', this.$controlModalContent).on('click', function(ev) {
          var parentCID = self._activeParentCID;

          if ('trigger' === self.model.get('type')) {
            if (self.model.get('config').channel_id === parentCID) {
              parentCID = self._activeParentCID = 'source';
            }
          }

          self._transformView.confirm(self._activeCID, self._activeParentCID, function(newCid, transforms) {
            var parentCID = self._activeParentCIDSource ? 'source' : self._activeParentCID,
              hub = self.model.get('hub');

            //
            if (!hub[parentCID]) {
              hub[parentCID] = {};
            }

            if (!hub[parentCID].edges) {
              hub[parentCID].edges = [];
            }

            if (!hub[parentCID].transforms) {
              hub[parentCID].transforms = {};
            }

            ptr = hub[parentCID];

            if (self._activeCID != newCid) {
              // replace activeCID with CID and propogate to transforms
              self.model.hubReplace(self._activeCID, newCid);

              // propagate id's into hub
              self.hubView.channelReplace(self._activeCID, newCid);
            }

            ptr.transforms[newCid] = transforms;

            if ($.inArray(newCid, ptr.edges) < 0) {
              ptr.edges.push(newCid);
            }

            self.hubView.trigger('channel:valid', newCid);
            self._controlPaneRest();
          });

          return false;
        });

        $('.modal-delete', this.$controlModalContent).on('click', function(ev) {
          self.hubView._removeSelectedNode();
          self.hubView._selectionState.link = null;
          self.hubView._selectionState.node = null;
          self.hubView._redraw(true);

          self._controlPaneRest(true);

          return false;
        });

        this._bindModalEvents();
      },

      // ---------------------------- TRIGGER CONFIG MODAL

      _controlPaneConfigureTrigger : function() {
        var self = this;

        this._toggleOverlay();

        // setup modal content
        this._triggerView.render(self._activeCID);

        // drop delete button
        $('.modal-delete', this.$controlModalContent).remove();

        // store transform
        $('.modal-confirm', this.$controlModalContent).on('click', function(ev) {
          self._triggerView.confirm(self._activeCID);
          return false;
        });

        this._bindModalEvents();
      },

      changeZIndex: function(item, zindex) {
        item.style.zIndex = zindex
      },

      maximizeModal: function() {
        $("#resizeModal").attr('class', 'icon-resize-small');
        $('#modal-wrapper')[0].style.position = 'absolute'
        $('.modal-content').height($(window).height());
        $('#channel-connect').height($(window).height());
        $('#modal-wrapper').offset({top: "0", left: this.modalWrapperPos.left});
      },

      minimizeModal: function() {
        $("#resizeModal").attr('class', 'icon-resize-full');
        $('#modal-wrapper')[0].style.position = 'relative';
        $('.modal-content').height($('#hub').height());
        $('#channel-connect').height($('#hub').height());
        //$('#modal-wrapper').offset({top: this.modalWrapperPos.top, left: this.modalWrapperPos.left});
       $('#modal-wrapper').css("top", "").css("left", "");
      },
      // ------------------------------------------------------------------------------------------

      invalidModel : function(model, errors) {
        var attr, error;

        // clear dom elements
        this.clearErrorClasses();

        for (key in errors) {
          attr = key;
          error = errors[key];

          // no error dom for the hub, so it gets growled
          if (/^hub/.test(attr) ) {
            BipClient.growl(error, 'error');

          } else if (/^end_life/.test(attr) ) {
            this.errTranslate(true, attr.replace(/\..*/g, ''), error);

          } else {
            this.errTranslate(true, attr, error);
          }
        }
      },

      clearErrorClasses : function(model, attr) {
        var el = $('#hub').siblings('.control-group');
        el.removeClass('error');
        el.find('.help-block').html('');

        this.errTranslate(false, 'end_life');
        this.errTranslate(false, 'name');
        this.errTranslate(false, 'note');
      },

      _setupValidation : function() {
        var self = this;
        Backbone.Validation.bind(this, {
          model : this.model,
          invalid :  function(view, attr, error) {
            if (/^hub/.test(attr) ) {
              //var el = $('#hub').siblings('.control-group');
              var el = $('#hub').parents('.control-group');

              el.addClass('error');
              el.find('.help-block').html(error);

              var panelFor = $(el).parents('.tab-pane').attr('id');
              //$('#bip-config-tabs li a[href="#' + panelFor + '"]').attr('required', true).attr('empty', true);
              $('#bip-config-tabs li a[href="#' + panelFor + '"]').addClass('alert-danger');

              BipClient.growl(error, 'error');

            } else if (/^end_life/.test(attr) ) {
              self.errTranslate(true, attr.replace(/\..*/g, ''), error);
              BipClient.growl(error, 'error');
            } else {
              self.errTranslate(true, attr, error);
              BipClient.growl(error, 'error');
            }
          },
          valid : function(view, attr, error) {
            if (/^hub/.test(attr) ) {
              var el = $('#hub').siblings('.control-group');
              el.removeClass('error');
              el.find('.help-block').html('');

            } else if (/^end_life/.test(attr) ) {
              self.errTranslate(false, attr.replace(/\..*/g, ''), error);
            }
          }
        })
      },
/*
      _setupResize : function($modal) {
        if ($modal.data('uiResizable')) {
          $modal.resizable('destroy');
        }

        $('.modal-content', $modal).css({
          position: 'absolute',
          bottom: '69px',
          top: '63px',
          left: 0,
          right: 0,
          overflow: 'auto'
        });

        $('footer.modal-footer', $modal).css({
          position: 'absolute',
          bottom : 0,
          left: 0,
          right : 0
        });

        $modal.css({
          'min-width' : 924,
          'overflow' : 'hidden'
        });

        //

        $modal.resizable();
      },
*/
      setTrigger : function(cid) {
        var channel = BipClient.getCollection('channel').get(cid),
          self = this,
          currentConfig = this.model.get('config'),
          currentHub = this.model.get('hub'),
          modelStruct =  {
            name : $('#bip_name').val() || channel.get('name'),
            note : channel.get('note'),
            type : this.model.get('type') || 'trigger',
            config : {
//              channel_id : self.hubView._enumerateActionPointer(cid),
              channel_id : cid,
              config : _.clone(currentConfig.config)
            },
            hub : Object.keys(currentHub).length
                ? currentHub
                : {
                  source : {
                    edges : []
                  }
            }
          };

        self.model.set(
          modelStruct,
          {
            silent : true
          }
        );

        $('#bip_name').val(modelStruct.name);

        self.hubView.setTriggerSourceParams(self.model);
        self.isNewTrigger = false;
        delete self._channelListView;

        // enable expiry and schedule
        $('#tab-schedule,#tab-expiry').show();

        // let dragagble figure itself out and then refresh list

        self._controlPaneRest();

/*
        if (!self.model.get('hub').source.edges.length) {
          BipClient.growl('Event Source Selected, Add Some Actions!');
        }
*/
      },

      saveRefresh : function(closeModal) {
        var self = this;

        BipClient.getCollection('bip').fetch(
        {
          reset : true,
          success : function() {
            if (closeModal) {
              self.modalClose();
            }
          }
        }
        );
      },

      closeRefresh : function() {
        BipClient.getCollection('bip').fetch( {
          reset : true
        } );
        this.modalClose();
      },

      deleteBip : function(ev) {
        $('.btn-success', this.deleteModal).attr('data-bip-id', this.model.id);
        this.deleteModal.modal();

        BipClient.centerModal($('.modal', this.deleteModal));

        return false;
      },

      // translates from a model attribute to form, and renders an error
      errTranslate : function(isErr, attribute, error) {
        var el = $('#bip_' + attribute, self.el).parent();
        var ctlGroup = $('#bip_' + attribute, self.el).closest('.control-group');
        if (isErr) {
          ctlGroup.addClass('error');
          el.children('.help-block').html(error);

          var panelFor = $(el).parent().attr('id');
          //$('#bip-config-tabs li a[href="#' + panelFor + '"]').attr('required', true).attr('empty', true);
          $('#bip-config-tabs li a[href="#' + panelFor + '"]').addClass('alert-danger');

        } else {
          el.removeClass('error');
          ctlGroup.children('.help-block').html('');
        }
        return el.length;
      },

      // check if the edge is childof the source at any level
      isChildOfSource: function(parent, edge) {
        if(edge == 'source'){
          return true;
        }
        parent = parent == null ? 'source' : parent;
        var hub = this.model.attributes.hub;
        if(hub[parent]){
          if($.inArray(edge, hub[parent].edges) > -1){
            return true
          } else{
            for (var i = 0, l=hub[parent].edges.length; i<l; i++){
              if(this.isChildOfSource(hub[parent].edges[i], edge))
                return true;
            }
          }
        }
        return false;
      },

      //travers the hub and remove all the useless sources and sources transforms
      clearEdgesTransforms : function(edge){
        var hub = this.model.attributes.hub;
        var sourceEdges = hub[edge].edges;

        if(sourceEdges.length >0 ){
          var sourceTransforms = hub[edge].transforms;
          for(var key in sourceTransforms) {
            if($.inArray( key, sourceEdges ) < 0)
              delete sourceTransforms[key];
          }
        } else {
          if (!hub[edge].exports && !hub[edge].title) {
            delete hub[edge];
          }
        }

        //delete the edges that arent children of the initial source recursively
        var sourceChild = this.isChildOfSource(null, edge);
        if(!sourceChild){
          delete hub[edge];
        }

        // if source has been trimmed, then put it back
        if ('source' == edge && !hub[edge]) {
          hub[edge] = BipClient.getCollection('bip').factoryDefault().get('hub').source;
        }

      },

      publish : function(e) {
        var id,
        name,
        domain_id,
        type,
        config,
        hub,
        note,
        end_life,
        paused,
        self = this,
        endLife,
        isNew = this.model.isNew(),
        cid = $.trim($('#channel_id_selected').val()),
        $btn = $(e.currentTarget);

        e.preventDefault();

        // drop panel error attributes
        $('#bip-config-tabs li a').removeAttr('required').removeAttr('empty');

        var end_life = {
          imp : $.trim($('#bip_expiry_imp').val()),
          time : "",
          action : $('#bip_expire_behaviour :button.active').attr('data-selection')
        }

        var expiryDate = $('#bip_expiry_date').val();
        if (expiryDate) {
          var modelEndLife = this.model.get('end_life');

          // if date changed...
          var modelExpireDate = new Date(modelEndLife.time * 1000);
          if (expiryDate != modelExpireDate.toString('dd-MM-yyyy')) {
            end_life.time = expiryDate;
          } else {
            end_life.time = modelEndLife.time;
          }
        } else {
          // assemble save str
          var expiryTime = $.trim($('#bip_expiry_time').val());
          if (expiryTime != '' && expiryTime != 0) {
            end_life.time = '+' + expiryTime + $.trim($('#bip_expiry_time_resolution').find(':selected').val())
          }
        }

        var bipStruct = {
          name : $.trim($('#bip_name').val()),
          domain_id : $.trim($('#domain_id :selected').val()),
          note : $.trim($('#bip_note').val()),
          end_life : end_life,
          schedule : JSON.parse(JSON.stringify($('#bip-schedule').scheduler('value')))
        }

        if (this.model.get('type') === 'http') {
          bipStruct.config = this.model.get('config');
          bipStruct.config.auth = $('#auth').find(':selected').val();
          bipStruct.config.username = $('#auth_username').val();
          bipStruct.config.password = $('#auth_password').val();
        }

        this.model.set(bipStruct);

        for(var key in this.model.attributes.hub) {
          this.clearEdgesTransforms(key)
        };

        // no event source selected? tell the user they need to do something
        if ( this._isWaiting() ) {
          BipClient.growl('Please Select An Event Source');

        } else if (this.model.isValid(true)) {
          // copy from working clone into authoritative model
          $btn.button('loading');
          var realModel = this.model.id
            ? BipClient.getCollection('bip').get(this.model.id)
            : this.model;

          // Backbone does strange things with nested values
          // so force a hub update
          realModel.set(this.model.toJSON());

          this.model = realModel;
          realModel.save(
          realModel.toJSON(),
          {
            silent  : false,
            patch : true,
            sync    : true,
            success : function(model, res, xhr) {
              $btn.button('reset');
              if (res && res.errors) {
                that.renderErrMsg(res.errors);
                $("#bip-submit i").removeClass("icon-save").addClass("icon-warning-sign");
                $("#bip-submit").removeClass("btn-success").addClass("btn-warning");
              } else {

                if ('shared' === self.mode && BipClient.activeShare && self._activeShareID) {
                  BipClient.incShare(self._activeShareID);
                }

                BipClient.growl('Bip <strong>' + res.name + '</strong> Saved');

                if($btn.attr("id") == "bip-submit-close"){
                  self.saveRefresh(true);
                }
                else if($btn.attr("id") == "bip-submit"){
                  self.saveRefresh();
                  self._renderBip(false, false, 'refresh');
                }
              }
            },
            error: function(model, res, xhr) {
              var flash = false;

              $btn.button('reset');
              // conflict
              if (res.status === 409) {
                BipClient.growl('Bip Name Is Already In Use', 'error');

              } else if (res.status == 402) {
                BipClient.selectPlanRoute('num_bips');

              // handle general errors
              } else {

                if ('' !== res.responseText) {
                  var err = JSON.parse(res.responseText);
                  if (err && err.status === 400) {
                    for (var key in err.errors) {
                      if (!self.errTranslate(true, key, err.errors[key].message)) {
                        BipClient.growl(err.errors[key].message, 'error');
                      } else {
                        flash = true;
                      }
                    }
                  }
                }
              }

              if (flash) {
                BipClient.growl('There were errors', 'error');
              }
            }
          });
        }
      },

      reprUpdate : function(ev) {
        var bipname = $(ev.currentTarget).val(),
        domain = $('#domain_id :selected').html(),
        type = this.model.get('type'),
        repr;

        switch (type) {
          case 'http' :
            // @todo custom domains not https
            repr = 'https://' + domain + '/bip/http/' + bipname;
            break;
          case 'smtp' :
            repr = bipname + '@' + domain;
            break;
          case 'payload' :
              repr = bipname + '@' + domain;
              break;
          case 'trigger' :
            repr = bipname;
            break;
          case 'default' :
            break;
        }

        this.model.set('name', bipname);
        this.model.set('_repr', repr);

        $('#bip-repr', this.el).html(repr);
        if (this._authView) {
          this._authView.setAuthHeaderHint();
        }
      },

      modalClose : function() {
        this.trigger('modal-destroy');
        if ('shared' == this.mode) {
          this._router.navigate('#community', { trigger : true });
        } else {
          this._router.navigate('#bipio', { trigger : true });
        }
      },

      pauseBip : function(action, message, next) {
        var self = this;

        this.model.save({
          paused : (action == 'play') ? false : true
        }, {
          patch : true,
          success : function() {
            if (next) {
              next();
            }

            BipClient.growl(message || '<strong>' + self.model.get('name') + '</strong> is ' + ((action === 'play') ? 'Active' : 'Paused'));

            var $pauseBtn = $('#bip-controls button.pause-action[data-action=play]'),
              $playBtn = $('#bip-controls button.pause-action[data-action=pause]');

            // toggle buttons
            if ('pause' === action) {
              $playBtn.hide();
              $pauseBtn.show();
            } else {
              $playBtn.show();
              $pauseBtn.hide();
            }

            BipClient.getCollection('bip').get(self.model.id).set('paused', self.model.get('paused'));
          }
        });
      },

      pauseAction : function(ev) {
        var action = $(ev.currentTarget).attr('data-action'),
        $btn = $(ev.currentTarget),
        self = this;
        ev.preventDefault();

        this.pauseBip(action, undefined, function() {
          $btn.button('reset');
        });
      },

      shareAction : function(ev) {
        var self = this,
          bip = this.model;

        var sView = new BipShareView();
        sView.share(bip);

        return false;
      },

      triggerAction : function(ev) {
        var self = this,
          id = $(ev.currentTarget).attr('data-id');

        BipClient.triggerBip(id);

        ev.preventDefault();
      },

      _setAuthHeaderHint : function() {
        switch (selected) {
          case 'basic' :
            break;
          case 'token' :
            break;
          default :
            break;
        }

        $('#auth-headers').text(authHeader);
      },

      toggleAuth : function(ev) {
        var src = $(ev.currentTarget),
          authHeader = '',
          selected = src.find(':selected').val();
          ev.preventDefault();

        if ('basic' === selected) {
          $('#auth-control').css('display', 'block');
        } else {
          $('#auth-control').css('display', 'none');
        }
      },

      nameChanged : function(){
        $("#bip_name").val($("#bip-name").val());
      },

      toggleRepr : function() {
        var $repr = $('#bip-repr', this.$el),
          $ep = $('#bip-endpoint', this.$el),
          $to, $from;

        if ($ep.is(':visible')) {
          $to = $repr;
          $from = $ep;
        } else {
          $to = $ep;
          $from = $repr;
        }

        $from.addClass('hidden');
        $to.removeClass('hidden');
      }
    });

    return BipEditView;
  });
define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/bipio/views/channel/v_transform',
  'apps/pods/views/v_channel_select_inline',
  'apps/bipio/views/v_req_parser',
  ], function(_, Backbone, BipClient, TransformView, ChannelInlineView, ParserView){

    ConfigView = Backbone.View.extend({
      tplModalTransform : _.template($('#tpl-bipio-modal-transform').html()),

      tplRpcTab : _.template($('#tpl-bipio-rpc-tab').html()),

      _transformView : null,
      _ilView : null,
      _isContainerAction : false,
      _hasConfig : false,
      sinceTime : null,
      events: {},
      initialize:function (model, el) {
        var self = this;
        _.bindAll(
          this,
          'render',
          'confirm',
          '_bindRPCs',
          '_addRPC'
        );

        this.el = el;
        this.$el = $(el);

        this.model = model;
      },
      getChannelDict : function(cid) {
        var channel,
          config = {},
          channelJSON;

        // create a dummy channel from http and email (bip sources)
        if ('http' === cid) {
          var dict = this.model.toJSON()
          if(dict.config && dict.config.channel_id) {
        	  channelJSON = {
  	            title : this.model.get('_repr'),
  	            name : this.model.get('name'),
  	            note : this.model.get('note') || 'Processes incoming ' + dict.config.channel_id.split('.')[0] +' requests to any of your domains',
  	            _action : {
  	              config : {}
  	            },
  	            pod : {
  	              title : BipClient.getCollection('channel').get(dict.config.channel_id).getPod().get('title'),
  	              icon : this.model.getIcon(),
                  auth : {
                    _repr : ''
                  }
  	            }
  	          }
          } else {
        	  channelJSON = {
	            title : this.model.get('_repr'),
	            name : this.model.get('name'),
	            note : this.model.get('note') || 'Processes incoming HTTP requests to any of your domains',
	            _action : {
	              config : {}
	            },
	            pod : {
	              title : 'Incoming Web Hook',
	              icon : this.model.getIcon(),
                auth : {
                  _repr : ''
                }
	            }
	          }
          }

        } else if ('smtp' === cid) {
          channelJSON = {
            title : this.model.get('_repr'),
            name : this.model.get('name'),
            note : this.model.get('note') || 'Processes incoming Email to any of your domains',
            _action : {
              config : {}
            },
            pod : {
              title : 'Incoming Email',
              icon : this.model.getIcon(),
              auth : {
                _repr : ''
              }
            }
          }

        } else if ('payload' === cid) {
          channelJSON = {
            title : this.model.get('_repr'),
            name : this.model.get('name'),
            note : this.model.get('note') || 'Generate Data',
            _action : {
              config : {}
            },
            pod : {
              title : 'Generate Data',
              icon : this.model.getIcon(),
              auth : {
                _repr : ''
              }
            }
          }

         } else if ('trigger' === cid) {
          channelJSON = {
            title : this.model.get('_repr'),
            name : this.model.get('name') ||  "Every Bip Needs An Event Source.<br/><br/>Click To Begin",
            note : this.model.get('note'),
            _action : {
              config : {}
            },
            pod : {
              title : 'Event Source',
              icon : this.model.getIcon(),
              auth : {
                _repr : ''
              }
            }
          }

        } else {
          channel = BipClient.getChannel(cid);

          channel.set('name', this.model.getTitleForCid(cid));

          channelJSON = channel.toJSON();
          channelJSON.pod = {
            title : channel.getPod().get('title'),
            icon : channel.getIcon(),
            auth : {
              _repr : channel.getPod().get('auth')._repr
            }
          }
          channelJSON._action = channel._action;
        }

        if (channel) {
          channelJSON.icon = channel.getIcon();
          channelJSON.hasConfig = channel.getPod().hasConfig(channel.get('action'));
          channelJSON.isContainerAction = BipClient.isContainerAction(channel.get('action'));
        } else {
          channelJSON.icon = channelJSON.pod.icon;
        }

        // set control pane
        // create config representation
        _.each(channelJSON._action.config.properties, function(prop, key) {
          var val = prop['default'];
          if (channelJSON.config[key] && '' !== channelJSON.config[key] ) {
            val = channelJSON.config[key];
          }

          if (val) {
            config[prop.title] = val;
          }
        });

        channelJSON._configItems = config;
        channelJSON._hover = false;

        // if no title could be derived, fall back to the pod description
        if (!channelJSON.name) {
          channelJSON.name = channelJSON.title;
        }

        channelJSON.rpcs = [];
        // -------------- HANDLE RPCS
        if (!BipClient.isUUID(cid)) {

           //NEED TO ADD HERE THE SCHEMA RPC's in case no channel

        } else {

          for (var i = 0; i < channelJSON._links.length; i++) {
            channelJSON["rpcs"].push({
              "_href": BipClient.getRendererURI(
                channelJSON.id,
                channelJSON._links[i].name
              ),
              "contentType": channelJSON._links[i].contentType,
              "description":channelJSON._links[i].description,
              "name":  channelJSON._links[i].name,
              "title": channelJSON._links[i].title
            });
          }
        }

        // -------------- RPCS
        return channelJSON;
      },

      _addRPC : function(name, schema, cid) {
        // skip invoke
        if ('invoke' === name) {
          return;

        // suppress rpc's which are not GET methods
        } else if (schema.method && schema.method !== 'GET') {
          return;
        }

        var self = this,
          $tabTitles = $('#b-config-tabs', this.$el),
          $tabContent = $('.tab-content', this.$el),
          tabId = 'rpc-' + name + '-panel',
          url;

        $tabTitles.append(
          '<li class="rpcTab"><a id="tab-' + tabId + '" href="#' + tabId + '" data-toggle="pill">' + schema.title + '</a></li>'
        );

        // interpolate variables we know about
        url = schema._href;

        url = url.replace(/:channelId/, cid);
        if (self.model.id) {
          url = url.replace(/:bip_id/, self.model.id);
        }

        // if there's a 'since' time, then add based on modal open time
        if (schema.properties && schema.properties.since && this.sinceTime) {
          url += ((-1 === url.indexOf('?')) ? '?' : '&') + 'since=' + this.sinceTime;
        }

        $tabContent.append(
          self.tplRpcTab({
            tabId : tabId,
            schema : schema,
            url : url
          })
        );

        $('#' + tabId + ' .btn-refresh', $tabContent).on('click', function() {
          self._fetchData('#' + $(this).parents('.rpcTab').attr('id'), true);
        });
      },

      _fetchData : function(panelId, force) {
        var self = this;

        $tabContent = $(panelId);
        $url = $('.rpc-url', $tabContent).text();

        contentType = $tabContent.attr('data-content-type');

        if ('text/html' === contentType || -1 !== contentType.indexOf('xml')) {
          $panel = $('iframe', $tabContent);

          if ($panel.length) {
            if (!$panel.attr('src') || force) {
              $panel.attr('src', $url);
            }
          }

        } else {
          $panel = $(panelId + ' pre');

          if ($panel.length) {

            if (!force && $panel.text()) {
              return;
            }

            $panel.empty();
            $panel.append($('.roto', self.tplLoader()));
            $.ajax({
              url : $url,
              success : function(resData) {
                if ('application/json' === contentType) {
                  $panel.html(BipClient.htmlEncode(JSON.stringify(resData, true, 4 )));
                } else {
                  $panel.html(BipClient.htmlEncode(resData));
                }
              },
              error : function() {
                $panel.empty();
                BipClient.growl('Error Reaching ' + $(panelId.replace('#', '#tab-')).text() + ' Endpoint', 'error');
              }
            });
          }
        }
      },

      _bindParserTab : function(channel) {
        var self = this;

        if (ParserView.test() && BipClient.isParsable(channel.get('action'))) {
          // enable the tab
          $tabTitles = $('#b-config-tabs', this.$el);
          tabId = 'edge-parser-panel';
          $tabPane = $('#' + tabId);

          $tabTitles.append(
            '<li id="parserTab"><a id="tab-' + tabId + '" href="#' + tabId + '" data-toggle="pill">Parser</a></li>'
          );

          // start parser view
          var parserView = new ParserView(
            {
              el : $('.parser-content', $tabPane),
              tplSelector : '#tpl-bipio-parser-mini'
            }
          );

          parserView.render(self.model.getExportsForCid(channel.get('id')));

          parserView.on('schema:imported', function(schema) {
            self.model.setExportsForCid(channel.get('id'), schema);
          });
        }
      },

      _bindRPCs : function(cid) {
        var self = this,
          channel = BipClient.getChannel(cid),
          links = channel ? channel.get('_links') : [],
          $tabs;

        // drop any rpc tabs
        $('#b-config-tabs .rpcTab,.tab-content .rpcTab').remove();


        if (!channel) {
          return;
        }

        // inject parser tab
        self._bindParserTab(channel);

        // inject system RPC's
        for (var i = 0; i < links.length; i++) {
          this._addRPC(links[i].name, links[i], cid);
        }

        // get dynamic rpc's
        _.each(channel.getAction().rpcs, function(schema, rpcName) {
          if ( !_.findWhere(links, { name : rpcName } ) && schema._href && !BipClient.isContainerAction(cid)) {
              self._addRPC(rpcName, schema, cid);
          }
        });

        $tabs = $('#b-config-tabs a');

        $tabs.off('click').on('click', function (e) {
          var $this = $(this),
            $tabContent,
            $panel,
            $url,
            title = $this.text(),
            contentType;

          e.preventDefault();

          if ($(this).parent().hasClass('rpcTab')) {
            self._fetchData($this.attr('href'));
          }

          $(this).tab('show');
        });
      },

      render : function(selectedCid) {
        var self = this,
          channel = BipClient.getChannel(selectedCid),
          channelJSON = this.getChannelDict(selectedCid);

        this._hasConfig = channel.getPod().hasConfig(channel.get('action'));
        this._isContainerAction = BipClient.isContainerAction(channel.get('action'));

        if (channel) {
          channelJSON.icon = channel.getIcon();
        } else {
          channelJSON.icon = channelJSON.pod.icon;
        }

        channelJSON.hasConfig = this._hasConfig;
        channelJSON.isContainerAction = this._isContainerAction;

        this.$el.html(
          this.tplModalTransform(channelJSON)
        );

        this._transformView = new TransformView('#panel-channel-transform-body');

        // propogate transform:invalid events
        self._transformView.on('transform:invalid', function() {
          self.trigger('transform:invalid');
        });

        this._ilView = new ChannelInlineView('#inline-channel');

        if (this._hasConfig) {
          var ilView = this._ilView;

          ilView.render(
            channel.get('action'),
            this._isContainerAction && channel.id && BipClient.isUUID(channel.id) ? channel : null
          );

          ilView.on('channel:selected', function(cid) {
            self._transformView.applyPresets(cid);
            if (!self.model.isNew()) {
              self._bindRPCs(cid);
            }
          });

          ilView.on('channel:save', function() {
            ilView.saveChannel(self._transformView.getForm());
          });
        }

        // disable channel saves in the form and
        // handle when modal is updated
        if (ilView && this._isContainerAction) {
          $('.action-save', ilView.$el).remove();
        }

        // attach RPC's for saved edges
        if (!self.model.isNew()) {
          self._bindRPCs(channel.id);
        } else {

          // inject parser tab
          self._bindParserTab(channel);
        }

        $('.rpc-url').tooltip({
            placement: 'top'
        }).on('click', function() {
          // firefox
          if(document.createRange) {
            rangeToSelect = document.createRange();
            rangeToSelect.selectNode(this.firstChild);
            curSelect = window.getSelection();
            curSelect.addRange(rangeToSelect);
            return false;
          }
          // ie
          if(document.body &&
            document.body.createTextRange) {
            range = document.body.createTextRange();
            range.moveToElementText(this);
            range.select();
            return false;
          }
        });

        this.trigger('meta:refresh', channelJSON);
      },
      confirm : function(cid, next) {
        var self = this,
          formVars = self._transformView.getForm(),
          requiredFields = BipClient.find.channel(cid).getAction().imports.required,
          missingFields = [];

        var transforms = {}, err = [];
        self._transformView.setTransforms(transforms, err);

        if (!err.length) {
          if (this._isContainerAction) {
            // then get the selected channel id.
            // if ther'es no channel id, then create a channel
            var cid = this._ilView.getSelectedChannel();

            if (!cid) {
              this._ilView.saveChannel(formVars, function(cid) {
                if (next) {
                  next(cid, formVars)
                } else {
                  self.trigger('channel:set', cid, formVars);
                }
              });
            } else {
              if (next) {
                next(cid, formVars)
              } else {
                self.trigger('channel:set', cid, formVars);
              }
            }
          } else {
            if (next) {
              next(cid, formVars)
            } else {
              self.trigger('channel:set', cid, formVars);
            }
          }
        }
      }
    });

    return ConfigView;
  });
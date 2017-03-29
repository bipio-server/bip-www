define([
  'underscore',
  'backbone',
  'bipclient'
  ], function(_, Backbone, BipClient) {
    _.extend(Backbone.Model.prototype, Backbone.Validator);
    MBip = Backbone.Model.extend({
      get: function (attr) {
        var ret;
        if (typeof this[attr] == 'function') {
          return this[attr]();
        } else if ('_repr' === attr) {
          if ('' === this.attributes._repr) {
            return this.getTypeRepr(this.attributes.type);
          }
        // pseudo-action
        } else if ('action' === attr) {
          return 'bip.' + this.attributes.type;
        }

        return Backbone.Model.prototype.get.call(this, attr);
      },
      // @todo migrate all statics descriptions into this call
      getTypeRepr : function(type) {
        var typeStr = '';
        switch (type || this.get('type') ) {
          case 'http' :
            if(this.get('config') && this.get('config').channel_id) {
            	var hookName = BipClient.getCollection('channel').get(this.get('config').channel_id).getPod().get("name")
            	typeStr = 'Incoming ' + hookName + ' Web Hook';
            } else {
            	typeStr = 'Incoming Web Hook';
            }
            break;
          case 'smtp' :
            typeStr = 'Incoming Email'
            break;
          case 'trigger' :
            typeStr = 'Event Source'
            break;
          default :
            break;
        }

        return typeStr;
      },
      getIcon : function() {
        var icon = this.get('icon'),
          channelIcon,
          type = this.get('type');


        if (!icon && this.get('config') && this.get('config').channel_id) {
          icon = BipClient.getCollection('channel').get(this.get('config').channel_id).getIcon()
        }

        if (icon) {
          return icon;
        } else {
          return '/static/img/channels/32/color/bip_' + type + '.png';
        }
      },

      getManifest : function(skipFlow, distributeLimit) {
        var dict = this.toJSON(),
          pods = BipClient.getCollection('pod'),
          channels = BipClient.getCollection('channel'),
          channel, pod, icon, title, description;

        dict.type_description = this.get('_repr');
        dict.type_icon = this.getIcon();

        dict.normedManifest = [];

        var c = 0;

        for (var k in dict.hub) {
          if (dict.hub.hasOwnProperty(k)) {
            _.each(dict.hub[k].edges, function(cid) {
              channel = channels.get(cid);

              // look for action pointer
              if (channel) {
                tokens = channel.get('action').split('.');
                action = channel.getAction();

                icon = channel.getIcon();
                title = channel.getPod().get('title');
                description = channel.get('name');
              } else {

                tokens = cid.split('.');
                pod = pods.get(tokens[0])
                action = pod.getAction(tokens[1]);

                icon = pod.getIcon();
                title = pod.get('title');
                description = action.title;
              }

              if (true || !(skipFlow && 'flow' === tokens[0])) {
                dict.normedManifest.push({
                  pod : tokens[0],
                  action : tokens[1],
                  icon : icon,
                  title : title,
                  description : description
                });
              }
            });
          }
        }

        if (distributeLimit) {
          return BipClient.distributeManifest(dict, distributeLimit);
        } else {
          return dict;
        }
      },

      getExportsSchema : function() {
        var exports = this.get('exports');
        if (exports && Object.keys(exports).length ) {
          return exports;
        } else {
          return BipClient.getCollection('bip_descriptions').get('http').get('exports');
        }
      },

      getAuthHeader : function() {
        var authHeader = '',
          config = this.get('config');

        if (config.auth === 'token') {
          authHeader = 'Authorization: Basic ' + BipClient._auth.api_token_web;

        } else if (config.auth === 'basic') {
          authHeader = 'Authorization: Basic '
              + $.base64.encode(config.username + ':' + config.password);
        }

        return authHeader;
      },

      getCurlStr : function(exportsStr) {
        var authHeader = this.getAuthHeader(),
          curlStr;

        exportsStr = (exportsStr || JSON.stringify(BipClient.schema2JSON(this.getExportsSchema()))).replace(/"/g, '\\"'),

        curlStr = 'curl -X POST -d "'
            + exportsStr
            + '" -H "Content-Type:application/json"'
            + (authHeader ? (' -H "' + authHeader + '"') : '')
            + ' ' + this.get('_repr');

        return curlStr;
      },

      // remove edge
      // we don't delete hub[cid], because the
      // edge may be re-attached and we want to remember
      // transforms for the dropped edge
      removeEdge : function(cid) {
        var hub = this.get('hub'),
            edges = _.pluck(hub, 'edges'),
            transforms = _.pluck(hub, 'transforms');

        delete hub[cid];

        _.each(transforms, function(transform) {
          if (transform) {
            delete transform[cid];
          }
        });

        _.each(edges, function(edges) {
          var idx = edges.indexOf(cid);
          if (-1 !== idx) {
            edges.splice(idx, 1);
          }
        });
      },

      getChannelIds : function() {
        // create channel index
        var channels = [],
          attrs = this.toJSON();

        if ('trigger' === attrs.type && attrs.config.channel_id && '' !== attrs.config.channel_id) {
          channels.push(attrs.config.channel_id);
        }

        for (var k in attrs.hub) {
          if (attrs.hub.hasOwnProperty(k)) {
            if (attrs.hub[k].edges) {
              channels = channels.concat(attrs.hub[k].edges);
            }
          }
        }

        if ('http' === attrs.type && $.isPlainObject(attrs.config.renderer)
          && attrs.config.renderer.channel_id
          && attrs.config.renderer.renderer) {

          channels.push(attrs.config.renderer.channel_id);
        }

        return _.uniq(channels);
      },

      defaults: function() {
        var config;

        if (!userSettings) {
          return {};
        }

        // mongo hack. yuck.
        if (!userSettings.bip_config || Object.prototype.toString.call( userSettings.bip_config ) === '[object Array]') {
          config = {}
        } else if (userSettings.bip_hub) {
          config = {}
        }

        return {
          'id' : null,
          'name' : '',
          'domain_id' : userSettings.bip_domain_id,
          'type' : userSettings.bip_type,
          'config' : config,
          'hub' : userSettings.bip_hub,
          'icon' : null,
          'note' : '',
          'end_life' : userSettings.bip_end_life,
          'paused' : 0,
          'schedule' : {},
          '_repr' : ''
        }
      },
      validation : {
        'hub.source.edges' : {
          fn : function(value, attr, computedState) {
          	var self = this,
              err = {},
              errors =[],
              haveValue = (value && value.length > 0);
              haveRenderer = (computedState.config.renderer && computedState.config.renderer.renderer);

            if( (haveRenderer && !haveValue) || haveValue) {

              if (value) {

              	for(var i=0, l = value.length; i<l; i++) {

                  if (BipClient.isContainerAction(value[i]) && !BipClient.isUUID(value[i])) {

                    self.trigger(
                      "channel:invalid",
                      value[i],
                      "Needs Configuration"
                    );

                    return BipClient.find.channel(value[i]).get('name') + " Needs Configuration";
                  } else {
                		var channel =  BipClient.getCollection('channel').get(value[i]),
                      action = channel.getAction();

                		var requiredImports = action.imports && action.imports.required;

                		if(requiredImports) {

                			for (var j=0, len =requiredImports.length; j<len; j++) {
                				//check if it is filled in the hub
                				if(!computedState.hub.source.transforms
                          || !computedState.hub.source.transforms[value[i]]) {
                					errors.push(requiredImports[j]);
                				}
                			}
                    }
                  }

                  if (errors.length > 0) {
                    var channelName = channel.attributes.name;
                    err[channelName] = errors;

                    self.trigger(
                      "channel:invalid",
                      value[i],
                      "Missing Fields : " + errors.join(',<br/>')
                    );
                  }

              		this.mapEdges(err, value[i] , computedState.hub);
              	}
              }

          		if(Object.keys(err).length > 0){
          			var message = "Missing Required Fields";
          			return message;
          		}

          		return '';

            } else {
            	return 'This Bip needs some actions before it can be saved';
            }
          }
        },
        note : [
        {
          required : false
        },
        {
          maxLength : 1024,
          msg : 'note cannot exceed 1024 characters'
        }
        ],
        'config.channel_id' : {
          fn : function(value, attr, computedState) {
            var cid, channel, action, message = '',
              self = this;

            //if ('trigger' === computedState.type) {
            if (value) {
              cid = value;
              channel = BipClient.find.channel(cid);
              action = channel.getAction();
              // required config?

              if ( !BipClient.isUUID(value) && action.config.required) {
                if (computedState.config.config && !BipClient.isContainerAction(value)) {
                  for (var i = 0; i < action.config.required.length; i++) {
                    if (!computedState.config.config[action.config.required[i]]) {
                      message = "Missing Required Fields";
                      break;
                    }
                  }
                } else {
                  message = "Missing Required Fields";
                }
              }
            }

            if (message) {
              self.trigger(
                "channel:invalid",
                'source',
                message
              );
            }
            return message;
          }
        },
        'end_life.imp' : {
          fn : function(value, attr, computedState) {
            var err;
            if ( '' !== value && 0 !== value && (isNaN(Number(value)) || (parseInt(value) % 1 !== 0) ) ) {
              err = 'Expiry Impressions must be a whole number greater than 0';
            }

            return err;
          }
        },
        'end_life.time' : {
          fn : function(value, attr, computedState) {
            var err;
            // validate on server side
            /*
            if ( '' !== value && !moment(value).isValid() ) {
              err = 'Expiry Date must be a valid date';
            }
            */

            return err;
          }
        }
      },
      url: function() {
        var self = this;
        return BipClient.getResourceURL('bip', self);
      },
      mapEdges: function(err, source, hub){
    	  if(hub[source]){
    		  var newEdges = hub[source].edges;
    		  for(var i=0, l=newEdges.length; i<l; i++){
            var channel =  BipClient.getCollection('channel').get(newEdges[i]),
              action = channel.getAction();

            var requiredImports = action.imports && action.imports.required;

    			  if(requiredImports){
    				  for (var j=0, len =requiredImports.length; j<len; j++){
    					  var array =[];
    					  //check if it is filled in the hub
    					  if(!hub[source].transforms || !hub[source].transforms[newEdges[i]] || hub[source].transforms[newEdges[i]][requiredImports[j]] == "" || hub[source].transforms[newEdges[i]][requiredImports[j]] == null){
    						  array.push(requiredImports[j]);
    						  this.trigger("channel:invalid", newEdges[i], requiredImports[j] + " is required" );
    					  }
    					  if (array.length > 0) {
    						  var channelName = channel.attributes.name;
    						  err[channelName] = array;
    					  }
    				  }
    			  }
    			  if(hub[newEdges[i]]){
    				  this.mapEdges(err, newEdges[i], hub)
    			  }
    		  }
    	  }
    	  //return err;
      },

      // replaces a node in the hub, any edges and reliant transforms
      hubReplace : function(from, to) {
        var newHub = {},
          hub = BipClient.deepClone(this.get('hub'));

        // update trigger
        if ('trigger' === this.get('type') ) {
          var config = this.get('config');
          if (config.channel_id && from === config.channel_id) {
            config.channel_id = to;
          }
        }

        // traverse the hub
        _.each(hub, function(adjacencies, node) {
          // replace edges
          if (adjacencies.edges) {
            var idx = adjacencies.edges.indexOf(from);
            if (-1 !== idx) {
              adjacencies.edges.splice(idx, 1, to);
            }
            adjacencies.edges = _.uniq(adjacencies.edges);
          }

          // replace transforms
          if (adjacencies.transforms) {
            _.each(adjacencies.transforms, function(transforms, cid) {
              var txClone = BipClient.deepClone(transforms),
                regexp,
                ptr;

              if (from === cid) {
                ptr = adjacencies.transforms[to] = txClone;
                delete adjacencies.transforms[cid];
              } else {
                ptr = adjacencies.transforms[cid] = txClone;
              }

              _.each(ptr, function(template, key) {
                regexp = new RegExp('\\[%\s*?' + from, 'g');
                ptr[key] = template.replace(regexp, '[%' + to);
              });
            });
          }

          if (from === node) {
            newHub[to] = adjacencies;
          } else {
            newHub[node] = adjacencies;
          }

        });

        this.set('hub', newHub);
      },

      _cidIsTrigger : function(cid) {
        var config = this.get('config');
        return config && config.channel_id && config.channel_id === cid;
      },

      _setHubAttributeForCid : function(cid, attr, value) {
        var self = this,
          hub = this.get('hub'),
          cid = self._cidIsTrigger(cid) ? 'source' : cid;

        if (!hub[cid]) {
          hub[cid] = {
            edges : [],
            transforms : {}
          };
        }

        _.each(hub, function(struct, hubCid) {
          if (cid === hubCid) {
            struct[attr] = value;
          }
        });
      },

      _getAttributeForCid : function(cid, attr) {
        var value,
          cid = this._cidIsTrigger(cid) ? 'source' : cid;
          self = this;

        _.each(this.get('hub'), function(struct, hubCid) {
          if (cid === hubCid) {
            value = struct[attr] || value;
          }
        });

        return value;
      },

      // exports
      getExportsForCid : function(cid) {
        return this._getAttributeForCid(cid, 'exports');
      },

      setExportsForCid : function(cid, schema) {
        this._setHubAttributeForCid(cid, 'exports', schema);
      },

      // titles
      setTitleForCid : function(cid, title) {
        this._setHubAttributeForCid(cid, 'title', title);
      },

      getTitleForCid : function(cid) {
        return this._getAttributeForCid(cid, 'title')
          || BipClient.getCollection('channel').get(cid).get('name');
      }
    });

    return MBip;
  });
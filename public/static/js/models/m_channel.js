define([
  'underscore',
  'backbone',
  'bipclient'
  ], function(_, Backbone, BipClient) {
    MChannel = Backbone.Model.extend({
      defaults: {
        'id' : null,
        'name' : '',
        'action' : '',
        'config' : {},
        'note' : '',
        'app_id' : ''
        },

        validation : {
          name : [
			  function(value){
				console.log(value);
				console.log(this);
			  },
	          {
	            required : true,
	            msg : 'name required'
	          },
	          {
	            maxLength : 64,
	            msg : 'name cannot exceed 64 characters'
	          }
          ],
          note : [
	          {
	            required : false
	          },
	          {
	            maxLength : 1024,
	            msg : 'Note cannot exceed 1024 characters'
	          }
          ]
        },

        initialize: function() {
        },
        
        url: function() {
          var self = this;
          return BipClient.getResourceURL('channel', self);
        },
        
        getPodTokens : function() {
          return this.attributes.action.split('.');
        },
        
        getPod : function() {
          var tokens = this.getPodTokens();
          return BipClient.getCollection('pod').get(tokens[0]);
        },
        
        getPodName : function() {
          return this.getPod().get('name');
        },
        
        getPodIcon : function(action) {
          return this.getPod().getIcon(action);
        },
        
        getIcon : function() {
          if (this.get('icon')) {
            return this.get('icon');

          } else if (this.get('config').icon) {
            return this.get('config').icon;

          } else {
            var tokens = this.getPodTokens();
            // workaround until added to schemas
            if ('flow' === tokens[0]) {
              return '/static/img/channels/32/color/flow/' + tokens[1] + '.png';

            } else if ('dataviz' === tokens[0]) {
              return '/static/img/channels/32/color/dataviz/' + tokens[1] + '.png';
            } else {
              return this.getPodIcon(tokens[1]);
            }
          }
        },

        getAction : function(action) {
          var tokens = action ? action.split('.') : this.getPodTokens(),
            actionName = tokens[1],
            action = BipClient.getCollection('pod').get(tokens[0]).get('actions')[actionName];

          action.name = action.name || actionName;
          return action;

        },

        // helper to summarize the characteristics of config items
        _getSummary : function(enumFor, action) {
          var action = this.getAction(action),
            enums = {},
            ptr = action[enumFor];

          if (ptr && ptr.properties) {
            _.each(ptr.properties, function(prop, key) {
              var oneOf = prop.oneOf && prop.oneOf[0].$ref,
                anyOf = prop.anyOf && prop.anyOf[0].$ref,
                ptr;

              if (oneOf) {
                ptr = prop.oneOf[0].$ref;
              } else if (anyOf) {
                ptr = prop.anyOf[0].$ref;
              }

              enums[key] = {
                rpc_ref : ptr ? 0 === ptr.indexOf('/rpcs') : false,
                type : prop.type,
                oneOf : oneOf,
                anyOf : anyOf
              };

            });
          }

          return enums;
        },

        // gets config keys with $ref's
        getConfigSummary : function(action) {
          return this._getSummary('config', action);
        },

        hasImports : function() {
          var imports = this.getAction().imports.properties;
          return (imports && Object.keys(imports).length > 0);
        },

        hasConfig : function() {
          return this.getPod().hasConfig(this.get('action'));
        }
    });

  return MChannel;

});
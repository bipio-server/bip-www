define([
  'underscore',
  'backbone',
  'bipclient'
  ], function(_, Backbone, BipClient) {
    return Backbone.Model.extend({
      validate: function() {
      },
      initialize: function() {

      },
      getExports: function(actionName) {
        return this.actions[actionName].exports.properties;
      },
      getImports : function(actionName) {
        return this.get('actions')[actionName].imports.properties;
      },
      getRenderer : function() {

      },
      getIcon : function(actionName) {
        if ('flow' === this.get('name') && actionName) {
          return '/static/img/channels/32/color/flow/' + actionName + '.png'
        } else if ('dataviz' === this.get('name') && actionName) {
          return '/static/img/channels/32/color/dataviz/' + actionName + '.png'
        } else {
          return this.get('icon');
          //return '/static/img/channels/32/color/' + this.get('name') + '.png'
        }
      },
      isAuthed : function() {
        return ('accepted' === this.get('auth').status);
      },
      getAction : function(actionName) {
        return this.get('actions')[actionName];
      },

      isValidEnum : function(actionName, scheme, attribute, value) {
        var action = this.getAction(actionName),
          schema = action[scheme],
          ok = false,
          optEntity,
          pathTokens,
          paths,
          ptr,
          iterator;

        if (schema.properties[attribute]) {
          if (schema.properties[attribute].oneOf) {
            iterator = schema.properties[attribute].oneOf;

          } else if (schema.properties[attribute].anyOf) {
            iterator = schema.properties[attribute].anyOf;

          }

          if (iterator) {
            for (var i = 0; i < iterator.length; i++) {
              optEntity = iterator[i];
              if (optEntity['$ref']) {
                // either action or pod renderer paths
                context = optEntity['$ref'].indexOf('#') === 0
                  ? action
                  : this.toJSON();

                paths = optEntity['$ref'].replace(/^#\//, '').split('#');

                pathTokens = paths[0].split('/');
                if (!pathTokens[0]) {
                  pathTokens.shift();
                }

                for (var j = 0; j < pathTokens.length; j++) {
                  ptr = ptr ? ptr[pathTokens[j]] : context[pathTokens[j]];

                  // @todo if its an external $ref or renderer,
                  // should it be unpacked and tested?
                  if (ptr && ptr._href) {
                    return false;
                  }

                  if ( j === pathTokens.length - 1 ) {
                    if (/^{.*}$/.test(pathTokens[j])) {
                      return false;

                    } else {

                      if (ptr && ptr['enum']) {
                        return -1 !== ptr['enum'].indexOf(value);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        return ok;
      },
      hasConfig : function(actionPtr) {
        var tokens = actionPtr.split('.');

        if (tokens.length > 1) {
          actionPtr = tokens[1];
        } else {
          actionPtr = tokens[0];
        }

        var action = this.get('actions')[actionPtr];

        return !!(action
          && action.config
          && action.config.properties
          && Object.keys(action.config.properties).length);
      }
    });
});



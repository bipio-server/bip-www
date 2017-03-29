define([
  'underscore',
  'backbone',
  'models/m_pod',
  'bipclient'
  ], function(_, Backbone, PodModel, BipClient){
    PodCollection = Backbone.Collection.extend({
      model: PodModel,
      // pods are a little different, they're an abstract we can
      // describe with RPC's
      url: BipClient.getPodDescriptions,
      comparator : 'title',
      initialize : function() {
        BipClient.setCollection('pod', this);
      },
      parse: function(response) {
        var podArr = [], pod;
        for (podName in response) {
          pod = response[podName];

          pod.id = pod.name;

          // deprecate description and description_long
          // https://wotdotio.atlassian.net/browse/IN-83
          if (!pod.title) {
            pod.title = pod.description;
            pod.description = pod.description_long;
          }

          _.each(pod.actions, function(action) {
            if (!action.title) {
              action.title = action.description;
              action.description = action.description_long;
            }

            _.each(action.renderers, function(renderer) {
              if (!renderer.title) {
                renderer.title = renderer.description;
                renderer.description = renderer.description_long;
                delete renderer.description_long;
              }
            });
          });

          // ------------------

          podArr.push(pod);
        }
        return podArr;
      },
      getPod : function(path) {
        var tokens = path.split('.');
        return this.get(tokens[0]);
      },
      getActionSchema : function(path) {
        var tokens = path.split('.'),
        pod, action,
        ret;

        if (tokens.length === 2) {
          pod = this.get(tokens[0]);
          action = pod.get('actions')[tokens[1]];
          if (action) {
            ret = action;
          }
        }

        return ret;
      },

      getRenderable : function(toJSON) {
        var result = [], filtered, c;
        filtered = _.filter(this.models, function(m) {
          return Object.keys(m.get('rpcs')).length > 0;
        });

        if (toJSON) {
          _.each(filtered, function(pod) {
            result.push(pod.toJSON());
          });
          return result;
        } else {
          return filtered;
        }
      },

      getPodName : function(channel) {

      }
    });
    return PodCollection;
  });

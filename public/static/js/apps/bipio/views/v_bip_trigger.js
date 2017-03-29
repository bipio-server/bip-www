define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/bipio/views/v_node_config'
  ], function(_, Backbone, BipClient, NodeConfigView){

    CompositeTriggerView = NodeConfigView.extend({
      events: {},
      initialize : function() {
        NodeConfigView.prototype.initialize.apply(this, arguments);
      },
      render : function(selectedCid) {
        this.constructor.__super__.render.apply(this, arguments);

        this._transformView.renderTrigger(
          this.model,
          BipClient.getChannel(selectedCid)
        );
      },

      confirm : function(cid, parentCID, next) {
        var self = this,
          bipConfig = self.model.get('config');

        this.constructor.__super__.confirm.call(this, cid, function(cid, formVars) {
          if (self._isContainerAction) {

            // don't store any configs with the graph
            if (bipConfig.config) {
              delete bipConfig.config.config;
            }
          } else {
            bipConfig.config = _.clone(formVars)
          }

          self.trigger('channel:set', cid, formVars);

        });
      }
    });

     return CompositeTriggerView;
  });
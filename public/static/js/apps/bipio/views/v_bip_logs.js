define([
  'underscore',
  'backbone',
  'bipclient',
  'c_bip_log',
  'moment'
  ], function(_, Backbone, BipClient, BipLogCollection){
    BipLogsView = Backbone.View.extend({
        el: '#log-body',
        events: {
            'click a.prev' : 'previous',
            'click a.next' : 'next'
        },
        initialize:function (bipId) {
            var self = this;
            _.bindAll(
                this,
                'render'
            );

            this.collection = new BipLogCollection(bipId);

            this.refresh();
        },

        error : function(message) {
            this.$el.empty();

            BipClient.growl(message, 'error');
        },

        refresh : function(next) {
          var self = this;

          this.collection.fetch({
              success : function() {
                self.render();
                if (next) {
                  next();
                }
              },
              error : function() {
                self.error('An Error Occurred Retrieving Logs');
                if (next) {
                  next();
                }
              }
          });
        },

        render : function() {
          var models = this.collection.models,
            el = this.$el,
            modelJSON,
            logDate,
            channels = BipClient.getCollection('channel'),
            channel,
            codeMap = {
                'bip_create' : 'Created',
                'bip_deleted_auto' : 'Expired (Deleted)',
                'bip_deleted_manual' : 'Deleted',
                'bip_recieve' : 'Message Received',
                'bip_paused_auto' : 'Expired (Paused)',
                'bip_paused_manual' : 'Manually Paused',
                'bip_share' : 'Config Shared',
                'bip_unshare' : 'Config Un-Shared',
                'bip_invoke' : 'Invoked',
                'bip_channnel_error' : 'Error'
            };

          el.empty();

          for (var i = 0; i < models.length; i++) {

            logDate = moment(parseInt(models[i].get('created'))).format('MMMM Do YYYY, h:mm:ss a');

            modelJSON = models[i].toJSON();
            channel = channels.get(modelJSON.source);

            if (modelJSON.source && channel) {
                modelJSON.source = '<img class="mini hub-icon" src="' + channel.getIcon() + '"/> ' + channel.get('name');
            } else {
                modelJSON.source = 'system';
            }

            el.append(
              '<tr><td>' + logDate + '</td><td>'
              + codeMap[modelJSON.code] + '</td><td>'
              + modelJSON.source + '</td><td width="50%" class="' + ('bip_channnel_error' === modelJSON.code ? "alert alert-error" : "") + '">'
              + modelJSON.message
              + '</td></tr>');
          }
        }
    });

    return BipLogsView;
  });
define([
  'underscore',
  'backbone',
  'bipclient'
  ], function(_, Backbone, BipClient) {
    _.extend(Backbone.Model.prototype, Backbone.Validator);
    MBipShare = Backbone.Model.extend({
      get: function (attr) {
        var ret;
        if (typeof this[attr] == 'function') {
          return this[attr]();
        } else if ('_repr' === attr) {
          if ('' === this.attributes._repr) {
            switch (this.attributes.type) {
              case 'http' :
                ret = 'Incoming Web Hook';
                break;
              case 'smtp' :
                ret = 'Incoming Email'
                break;
              case 'trigger' :
                ret = 'Event Source'
                break;
              default :
                break;
            }
            return ret;
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
            typeStr = 'Incoming Web Hook';
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

        if ('trigger' === type && this.get('config').channel_id) {
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
          channel;

        dict.type_description = this.get('_repr');
        dict.type_icon = this.getIcon();

        dict.normedManifest = [];

        var c = 0;

        for (var k in dict.hub) {
          if (dict.hub.hasOwnProperty(k)) {
            _.each(dict.hub[k].edges, function(cid) {
              channel = channels.get(cid);
              tokens = channel.get('action').split('.');

              action = channel.getAction();

              if (true || !(skipFlow && 'flow' === tokens[0])) {
                dict.normedManifest.push({
                  pod : tokens[0],
                  action : tokens[1],
                  icon : channel.getIcon(),
                  title : channel.getPod().get('title'),
                  description : channel.get('name')
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
/*
      ___defaults: function() {
        return {
          'id' : null,
          'name' : '',
          'type' : userSettings.bip_type,
          'config' : {},
          'hub' : userSettings.bip_hub,
          'icon' : null,
          'note' : '',
          'owner_id' : '',
          'owner_name' : '',
          'paused' : 0,
          'manifest' : []
        }
      },
*/
      url: function() {
        return BipClient.getShareURL(this.id);
      },
      parse : function(response) {
        if (response.data.length) {
          return response.data[0];
        } else {
          return null;
        }
      }

    });

    return MBipShare;
  });



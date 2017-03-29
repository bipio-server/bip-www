/*
 * composite view iv channel/v_transform and inline channel views
 */
define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/bipio/views/v_node_config'
  ], function(_, Backbone, BipClient, NodeConfigView){

    CompositeTransformsView = NodeConfigView.extend({
      tplLoader :  _.template($('#tpl-loader').html()),
      events: {
      },
      initialize:function (model, el) {
        NodeConfigView.prototype.initialize.apply(this, arguments);

        _.bindAll(
          this,
          'setTransforms',
          'transformHint',
          'getForm',
          '_buildExports'
          );
      },

      setTransforms : function(transforms, err, indicatorPass) {
        this._transformView.setTransforms(transforms, err, indicatorPass);
      },

      getForm : function() {
        return this._transformView.getForm();
      },

      _buildExports : function(cid, tagExports) {
        var exportFor,
        id = cid,
        bip = this.model,
        exports = bip.getExportsForCid(cid),
        type = bip.get('type'),
        config = bip.get('config'),
        channels = BipClient.getCollection('channel'),
        channel;

        // bip definitions
        if (cid === 'source') {
          exportFor = type;
          if (type === 'trigger') {
            cid = config.channel_id;
          }
        // action definition
        } else {
          exportFor = 'channel';
        }

        exports = exports || BipClient.getExports(exportFor, cid);
        channel = channels.get(cid);

        if ('source' === id) {
          // superimpose exports over the generated hints
          if ('http' === type && this.model.get('exports')) {
            delete exports.properties.body;
            delete exports.properties.title;

            var modelExports = this.model.get('exports');

            modelExports.id = exports.id;
            modelExports.title = exports.title;

            tagExports[id] = modelExports;

          } else {
            tagExports[id] = exports;
          }

          tagExports[id].description = channel ? channel.get('name') : exports.title;

        } else {
          tagExports[channel.get('id')] = {
            name : channel.get('name'),
            properties : exports.properties
          }
        }

        // -------------------------------------------------

        channel = channels.get(cid === 'source' ? bip.get('config').channel_id : cid);

        // convert exports into something usable by templar
        if (exports.properties && Object.keys(exports.properties).length > 0) {

          var bipTransformSources = [ '_bip', '_client', '_files' ]

          for (var key in exports.properties) {
            //if (!/^_/.test(key)) {
            if (-1 !== bipTransformSources.indexOf(key)) {
              if ('_files' === key) {
                // skip files completely
                delete exports.properties[key];
                continue;
              }

              tagExports[key] = exports.properties[key];
              delete exports.properties[key];
            }
          }
        }

        return tagExports;
      },

      render : function(selectedCid, parentCid, parentCids, parentIsSource) {
        this.constructor.__super__.render.apply(this, arguments);

        var self = this,
          bip = this.model,
          props,
          action,
          txBody,
          txFrom,
          exports = {},
          channel = BipClient.getChannel(selectedCid);

          txTo = channel.get('action'),

          hubParent = bip.get('hub')[parentIsSource ? 'source' : parentCid];

        if ('trigger' === bip.get('type') || 'http' === bip.get('type') && bip.get('config').channel_id) {
          parentCids = _.without(parentCids, bip.get('config').channel_id);
          if (-1 === parentCids.indexOf('source')) {
            parentCids.push('source');
          }
        }

        txFrom = parentCids[parentCids.length - 1];

        for (var i = 0; i < parentCids.length; i++ ) {
          this._buildExports(parentCids[i], exports);
        }

        action = channel._action;

        // trigger transforms are different, we inspect
        // the triggering channel id instead
        var trigger = false;

        if (txFrom === 'source') {
          if (bip.get('type') === 'trigger') {
            channel = BipClient.getChannel(bip.get('config').channel_id);
            txFrom = channel.get('action');
            trigger = true;
          } else {
            txFrom = parentCids[parentCids.length - 1];
          }
        } else {
          channel = BipClient.getChannel(txFrom);
          txFrom = channel.get('action');
        }

        txBody = $('#panel-channel-transform-body');
        txBody.empty();
        txBody.append($('.roto', self.tplLoader()));

        var renderTransform = function() {
          self._transformView.render(
            bip,
            BipClient.getChannel(selectedCid),
            parentCid, // bip.http
            exports,
            parentIsSource
          );
        };

        // SETUP TRANSFORM
        if (action) {
          props = action.imports.properties;
        }

        if (props) {
          if (hubParent && hubParent.transforms && hubParent.transforms[selectedCid]) {
            renderTransform();
          } else {
            BipClient.getTransformHint(self, txFrom, txTo, renderTransform);
          }
        }
      },

      confirm : function(cid, parentCID, next) {
        var self = this,
          ptr,
          hub = self.model.get('hub'),
          bipConfig = self.model.get('config');

        this.constructor.__super__.confirm.call(this, cid, function(cid, transforms) {
          if (next) {
            next(cid, transforms);
          }

          self.trigger('channel:set', cid);
        });
      },


      _confirm : function(cid, parentCID) {
        var ptr,
          self = this,
            template,
            hub = self.model.get('hub'),
            transforms = {}
            err = [];

        if ('trigger' === self.model.get('type')) {
          if (self.model.get('config').channel_id === parentCID) {
            parentCID = 'source';
          }
        }

        // set
        self._transformView.setTransforms(transforms, err);

        // if there are error prevent the user from saving the transforms
        if( err.length > 0 ) {
          return;
        }

        this.constructor.__super__.confirm.call(this, function(cid) {

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

          ptr.transforms[cid] = transforms;

          if ($.inArray(cid, ptr.edges) < 0) {
            ptr.edges.push(cid);
          }

          self.trigger('channel:set', cid);
        });
      },

      transformHint : function(channelId, parentChannelId, isSource) {
        var self = this,
          bip = this.model,
          hubParent = bip.get('hub')[parentChannelId],
          cid = channelId,
          channels = BipClient.getCollection('channel'),
          txFrom,
          fromChannel,
          toChannel = channels.get(channelId);

        if (!toChannel) {
          return;
        }

        if (parentChannelId === 'source') {
          if (bip.get('type') === 'trigger') {
            txFrom = BipClient.getChannel(bip.get('config').channel_id).get('action');
          } else {
            txFrom = 'bip.' + bip.get('type');
          }
        } else {
          txFrom = BipClient.getChannel(parentChannelId).get('action');
        }

        BipClient.getTransformHint(self, txFrom, toChannel.get('action'), function(err, transforms, context) {
          if (!err) {
            if (!hubParent.transforms) {
              hubParent.transforms = {};
            }
            hubParent.transforms[cid] = {};
            _.each(transforms, function(value, key) {
              if(value != null) {
                hubParent.transforms[cid][key] = value;
                self.trigger('channel:valid', cid);
              } else {
                self.trigger("channel:invalid", cid , key + " is required");
              }
            });
          }
        });
      },
    });

    return CompositeTransformsView;
  });
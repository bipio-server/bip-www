define([
  'underscore',
  'backbone',
  'bipclient',
  'models/m_channel'
  ], function(_, Backbone, BipClient, ChannelModel){
    // Individual Channel (List)
    var ChannelInlineView = Backbone.View.extend({
      tplInlineChannel : _.template( $('#tpl-pods-inline-channel-select').html() ), // widget container

      actionPtr : null,

      collection : null,

      initialize: function(el) {

        _.bindAll(this, 'render', 'removeChannel');

        this.el = el;
        this.$el = $(el);

        this.collection = BipClient.getCollection('channel');

        $('#channel-delete-confirm').off('click');
        $('#channel-delete-confirm').on('click', this.removeChannel);
      },

      // tries to enumerate a sane preset name
      _getPresetName : function() {
        var idx = 1,
          self = this,
          tokens = [],
          lastIdxNum,
          lastIdx = -1,
          name = self.action.title,
          channels = BipClient.getCollection('channel').filter(
            function(obj) {
              if (self.actionPtr === obj.get('action') ) {
                if (0 == obj.get('name').trim().indexOf(name) ) {
                  return obj;
                }
              }
            });

        for (var i = 0; i < channels.length; i++) {
          tokens = channels[i].get('name').trim().split(' ');
          lastIdxNum = Number(tokens.pop());
          if (!isNaN(lastIdxNum) && lastIdxNum >= lastIdx ) {
            lastIdx = lastIdxNum;
          } else if (name === channels[i].get('name').trim()) {
            lastIdx++;
          }
        }

        return name + (lastIdx >= 0 ? ' ' + (lastIdx + 1) : '');
      },

      render: function(actionPtr, defaultChannel) {
        var tokens = actionPtr.split('.'),
          self = this,
          isContainerAction = BipClient.isContainerAction(actionPtr);

        this.actionPtr = actionPtr;

        this.action = BipClient.getCollection('pod').get(tokens[0]).getAction(tokens[1]);

        this.$el.html(
          this.tplInlineChannel()
        );

        var $form = $('div#channel-inline', this.$el),
          $input = $('input', $form),
          $select = $('select', $form),
          $deleteButton = $('.action-delete', this.$el);

        this.collection.forEach(function(channel) {
          var selected;

          if (channel.get('action') === actionPtr) {

            selected = (defaultChannel && channel.get('id') === defaultChannel.get('id'))

            $select.append(
              '<option ' + (selected ? 'selected="selected"' : '') + ' value="' + channel.get('id') + '">' + channel.get('name') + '</option>'
            );
          }
        });

        $select.select2({
          dropdownAutoWidth : true
        });

        $select.on('change', function() {

          self.errTranslate(false,'name');
          var cid = $(this).val(),
            channel = BipClient.find.channel(cid)

          if (cid && channel) {

            $input.val(
              channel.get('name')
            );
            $deleteButton.show();
          } else {

            $deleteButton.hide();
            //$input.val(self.action.title);
            $input.val(self._getPresetName());
          }

          self.trigger('channel:selected', cid );
        });

        $('button.action-save', $form).on('click', function() {
           self.trigger('channel:save');
        });
/*
        $('button', $form).on('click', function() {
          var $this = $(this);

          if ($this.hasClass('action-save')) {
            self.trigger('channel:save');

          } else if ($this.hasClass('action-delete')) {
            self.remove();

          }
        });
*/
        if (isContainerAction && !defaultChannel) {
          $input.val(self._getPresetName());
//          $input.val(
//            this.action.title
//          );
        } else if (defaultChannel) {
          $input.val(
            defaultChannel.get('name')
          );
        }

        if (defaultChannel) {
          $deleteButton.show();
        } else {
          $deleteButton.hide();
        }

      },

      // translates from a model attribute to form, and renders an error
      errTranslate: function(isErr, attribute, error) {
        var el = $('#channel-' + attribute, this.$el).closest('.control-group');

        if (isErr) {
          el.addClass('error');
          el.find('.help-block').html(error);
        } else {
          el.removeClass('error');
          el.find('.help-block').empty();
        }
      },

      removeChannel : function(e) {
        var self = this ,
        channel = this.collection.get($('select', this.$el).val()),
        $savebtn = $('.action-save', this.$el);

        e.stopPropagation();
        e.preventDefault();

        $savebtn.hide();

        $('#channel-delete-dialog').modal('hide');

        if (channel) {
          var channelName = channel.get('name'),
            actionPtr = channel.get('action');

          channel.destroy({
            success : function(model, response) {
              BipClient.growl('Preset <strong>' + channelName + '</strong> Deleted');
              self.render(actionPtr);
            },
            error : function(model, response) {
              $savebtn.show();
              var message = 'An Error Occorred';
              if (409 === response.status) {
                message = "<strong>" + channelName + "</strong> is in use";
              }

              BipClient.growl(message, 'error');
            },
            wait : true
          });
        }
      },

      getSelectedChannel : function() {
        return $('select', this.$el).val();
      },

      saveChannel : function(formVars, next) {
        var config = {},
          self = this,
          action = this.action,
          $btn = $('.action-save', this.$el);

        if (action.config && action.config.properties) {
          _.each(action.config.properties, function(props, key) {
            if (formVars[key]) {
              config[key] = formVars[key];
            }
          });
        }

        var $channelName = $('input#channel-name', this.$el),
          channelName = $channelName.val(),
          channel, cid = this.getSelectedChannel();

        if ($channelName && channelName && channelName.trim().length ) {

          if (cid) {
            channel = this.collection.get(cid);

          } else {
            channel = this.collection.findWhere({ name : channelName });

          }

          if (!channel) {
            channel = new ChannelModel({
              name : channelName,
              action : this.actionPtr,
              config : config
            });

          } else {
            // overwrite existing channel
            if (channel.get('action') === this.actionPtr) {

              if(channel.get('name') !== channelName){
            	  existChannel = this.collection.findWhere({ name : channelName });
            	  if(existChannel){
                     self.errTranslate(true, 'name', 'Preset Name Is Already In Use');
                    return;
            	  }
                  channel.set('name', channelName);
              }

              channel.set('config', config);

            // or raise dup name exception (action mismatch)
            } else {
              self.errTranslate(true, 'name', 'Preset Name Is Already In Use');
              return;
            }
          }

          Backbone.Validation.bind(this, {
             model : channel,
             invalid :  function(view, attr, error) {
            	 self.errTranslate(true, attr, error);
             },
             valid : function(view, attr, error) {
               self.errTranslate(false);
             }
           });

          if ( channel.isValid(true) ) {
            $btn.button('loading');
            channel.save(
              channel.toJSON(),
              {
                silent  : false,
                sync    : false,
                success : function(model, res, xhr) {
                  $btn.button('reset');

                  BipClient.getCollection('channel').fetch({
                    reset : true,
                    success : function() {
                      BipClient.decorateChannels();
                      if (next) {
                        next(channel.id);
                      } else {
                        self.render(channel.get('action'));
                      }

                    }
                  });

                  BipClient.growl('Preset <strong>' + channel.get('name') + '</strong> Saved');

                },
                error: function(model, res) {
                  $btn.button('reset');
                  try {
                    var resp = JSON.parse(res.responseText);
                    // conflict
                    if (res.status === 409) {
                      self.errTranslate(true, 'name', 'Preset Name is already in use');

                    // handle general errors
                    } else {
                      if (resp.message) {
                        BipClient.growl(resp.message, 'error');
                      } else {
                        BipClient.growl('An Error Occurred', 'error');
                      }
                    }
                  } catch (e) {
                    BipClient.growl('An Unknown Error Occurred', 'error');
                    BipClient.getCollection('channel').fetch({
                      reset : true,
                      success : function() {
                        BipClient.decorateChannels();
                        if (next) {
                          next(channel.id);
                        } else {
                          self.render(channel.get('action'));
                        }

                      }
                    });
                  }
                }
              });
          }

        } else {
          self.errTranslate(true, 'name', 'Please Name This Preset');
        }
      }

    });

    return ChannelInlineView;
  });
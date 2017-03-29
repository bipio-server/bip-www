define([
  'underscore',
  'backbone',
  'bipclient',
  'c_bip'
  ], function(_, Backbone, BipClient, BipCollection) {

  var OutboxView = Backbone.View.extend({
    el : '#outbox-container',
    tplControls :  _.template( $('#tpl-outbox-controls').html() ),

    modalView : null,
    editor : null,
    lsPrefix : 'BIP_OUTBOX_',

    testMode : false,

    model : null,

    initialize: function(initMode, id) {
      var self = this;

      this.model = null;

      _.bindAll(
        this,
        'render',
        '_renderEndpoints',
        '_buttonHandler',
        '_obGet',
        '_obSet'
        );

      this.collection = BipClient.getCollection('bip');

      var defaultId;

      if ('test' === initMode && id) {
        defaultId = id;
        var bip = BipClient.find.bip(id);
        if (bip) {
          BipClient.growl('Testing ' + bip.get('name'));
          this.model = bip;
        }
        this.testMode = true;
      }

      this.collection.bind('reset', function() {
        self._renderEndpoints(self.collection.where({ type : 'http' } ));
      });

      this._renderEndpoints(this.collection.where({ type : 'http' } ), defaultId);
    },

    events: {
      'click button' : '_buttonHandler'
    },

    _obSet : function(key, value) {
      if (value) {
        value = value.replace(/<(\/?)script>/g, '');
      } else {
        value = '';
      }
      localStorage.setItem(this.lsPrefix + key, value);
    },

    _obGet : function(key) {
      return localStorage.getItem(this.lsPrefix + key);
    },

    render: function() {
      var self = this,
        mode = this.testMode ? 't' : this._obGet('MODE'),
        body = this._obGet('BODY'),
        $obBody = $('#outbox-body');

      // crate sample payload from bip exports schema
      if (this.testMode) {

        $obBody.height(Math.floor($('body').height() / 2));

        body = JSON.stringify(
          BipClient.schema2JSON(this.model.getExportsSchema()),
          true,
          4
        );

        this._curlView = new CurlView(this.model);
        this._curlView.render();
      }

      if (this.testMode) {
        $('#outbox-title').parents('.row:first').remove()
        $('#outbox-json-parse').prop('checked', true);

      } else {

        $('#outbox-title') .val(this._obGet('TITLE'));

        $('#outbox-json-parse').prop('checked', self._obGet('PARSE_JSON'));

        if (!mode) {
          mode = 'h';
          this._obSet('MODE', mode);
        }

        $('#outbox-title').on('blur', function() {
          self._obSet('TITLE', $(this).val());
        });

        $('textarea, .editable').on('blur', function() {
          // save state
          self._obSet('BODY', $('#outbox-body').redactor('code.get'));
          self._obSet('MODE', $('#outbox-body').redactor('core.getObject').opts.visual ? 'h' : 't');
          self._obSet('PARSE_JSON', $('#outbox-json-parse').is(':checked'));
        });
      }

      var redactorArgs = {
        focus : true,
        visual : (mode === 'h')
      };
      if (this.testMode) {
        var timer;
        redactorArgs.codeKeydownCallback = function() {
          clearTimeout(timer);
          timer = setTimeout(function() {
            var str = $obBody.redactor('code.get');
            try {
              str = JSON.stringify(JSON.parse(str));
            } catch (e) {
              str = str.replace(/\n/g, '');
            }

            self._curlView.render(str);

          }, 100);
        }
      }

      $obBody.redactor(redactorArgs);

      if (null !== body) {
        $obBody.redactor('insert.set', body, false);
      }
    },

    _setCodeBody : function() {
      var $obBody = $('#outbox-body'),
        body = JSON.stringify(
          BipClient.schema2JSON(this.model.getExportsSchema()),
          true,
          4
        );

      if (null !== body) {
        $obBody.redactor('insert.set', body, false);
      }
    },

    _buttonHandler : function(ev) {
      var url,
      $select = $('#outbox-bip-id', this.$el),
      config;

      ev.preventDefault();
      if (ev.currentTarget.id == 'outbox-send') {
        var bip = this.collection.get(
          $select.find(':selected').attr('value')
        ),
        parsedParams,
        params = {
          title : $('#outbox-title').val()
        };

        var bodyTxt = $('#outbox-body').text();

        if (bodyTxt || !$('#outbox-body').redactor('core.getObject').opts.visual) {
          params.body = $('#outbox-body').redactor('code.get');
        }

        if (!$('#outbox-body').redactor('core.getObject').opts.visual
          && $('#outbox-json-parse').is(':checked')) {

          try {
            parsedParams = JSON.parse($('#outbox-body').redactor('code.get'))
            params = parsedParams;
          } catch (e) {
            BipClient.growl(e, 'error');
            return;
          }
        }

        if (bip) {
          if (bip.get('paused')) {
            BipClient.growl('Cannot Test A Paused Bip', 'warning');
          } else {
            this._obSet('HOOK', bip.get('id'));
            BipClient.callHTTPBip(
              bip,
              params,
              function(err) {
                var msg = 'Server Error';
                if (!err) {
                  BipClient.growl('Message Sent');
                } else {
                  try {
                    msg = JSON.parse(err);
                    if (msg.message) {
                      msg = msg.message;
                    }
                  } catch (e) {
                  }

                  BipClient.growl(msg, 'error');
                }
              },
              'POST'
            );
          }
        }
      }
    },

    _renderEndpoints : function(httpModels, defaultId) {
      var self = this,
        bipId = defaultId || this._obGet('HOOK'),
        $select;

      if (httpModels.length !== 0) {
        $('#outbox-controls').html(this.tplControls());

        $select = $('#outbox-bip-id', this.$el);
        $select.empty();

        _.each(httpModels, function(bip) {
          $select.append('<option value="'
            + bip.get('id')
            + '" '
            + (bipId === bip.get('id') ? 'selected="selected"' : '')
            + '>'
            + bip.get('name')
            + '</option>');
        });

        $select.select2({
          containerCss : {
            width : '200px'
          }
        }).on('change', function(ev) {
          if (self._curlView) {
            self._curlView.setModel(
              BipClient.find.bip(ev.val)
            );
            self._curlView.render();
            self._setCodeBody();
          }
        })
      }
    }
  });
  return OutboxView;
});
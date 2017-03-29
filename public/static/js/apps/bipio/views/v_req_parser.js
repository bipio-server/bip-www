define([
  'underscore',
  'backbone',
  'bipclient'
  ], function(_, Backbone, BipClient){

    ParserView = Backbone.View.extend({
      tplParser :  _.template( $('#tpl-bipio-parser').html() ),
      events: {
      },
      initialize:function (opts) {
        var self = this;
        _.bindAll(
          this,
          'render',
          '_setExports'
          );

        var containerId = opts.containerId || 'bip-parser-panel';

        if (opts.tplSelector) {
          this.tplParser = _.template( $(opts.tplSelector).html() )
        }

        if (opts.tabContainer) {
          $(opts.tabContainer).append(
            '<li><a data-toggle="pill" href="#' + containerId + '"> Parser</a></li>'
          );
        }

        if (opts.contentContainer) {
          $(opts.contentContainer).append(
            '<div class="tab-pane span12" id="' + containerId + '"></div>'
          );
        }

        if (opts.el) {
          this.$el = opts.el;
        } else {
          this.el = '#' + containerId;
          this.$el = $(this.el);
        }

        // set tab content
        this.$el.html(
          this.tplParser()
        );

        $('#parse-json', this.$el).on('click', function() {
          var payload = $('#sample-request', self.$el).val(),
            $this = $(this);

          try {
            payload = JSON.parse(payload)

          } catch (e) {
            BipClient.growl('Payload Is Not Valid JSON', 'error');
            return;
          }

          $this.button('loading');

          BipClient._request(
            payload,
            BipClient.find.pod('flow').get('rpcs').json_to_schema._href,
            'POST',
            function(resData, payload) {
              self._setExports(resData);
              self.trigger('schema:imported', resData);
              $this.button('reset');
            },
            function(xhr_status, status, errText, payload) {
              BipClient.growl(errText, 'error');
              $this.button('reset');
            },
            true
          );
        });
      },

      _setExports : function(schema) {
        $('#json-schema', this.$el).html(
          JSON.stringify(schema, true, 4)
        );
      },

      render : function(schema) {
        schema = schema || {};
        this._setExports(schema);

        $('#sample-request').text(
          JSON.stringify(BipClient.schema2JSON(schema), true, 4)
        );
      }
    });

    ParserView.test = function() {
      var pod = BipClient.find.pod('flow'),
        ok = false;

      return (pod && pod.get('rpcs').json_to_schema);
    }

    return ParserView;
  });
define([
  'underscore',
  'backbone',
  'bipclient'
  ], function(_, Backbone, BipClient){

    CurlView = Backbone.View.extend({
      el : '#curl-repr',
      tpl :  _.template( $('#tpl-curl-repr').html() ),
      events: {},

      initialize:function (model) {
        var self = this;
        this.model = model;
        _.bindAll(
          this,
          'render'
          );
      },

      setModel : function(model) {
        this.model = model;
      },

      render : function(payloadStr) {
        this.$el.html(this.tpl({
          cmd : this.model.getCurlStr(payloadStr)
          })
        );

        $('pre', this.$el).tooltip({
            placement: 'top'
        }).on('click', function() {
          // firefox
          if(document.createRange) {
            rangeToSelect = document.createRange();
            rangeToSelect.selectNode(this.firstChild);
            curSelect = window.getSelection();
            curSelect.addRange(rangeToSelect);
            return false;
          }
          // ie
          if(document.body &&
            document.body.createTextRange) {
            range = document.body.createTextRange();
            range.moveToElementText(this);
            range.select();
            return false;
          }
        });
      }
    });

    return CurlView;
  }
);
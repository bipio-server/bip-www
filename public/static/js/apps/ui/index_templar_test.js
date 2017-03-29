/**
 *
 * BipIO graphs app.
 *
 * UI app container - for developing and testing views
 *
 */

String.prototype.repeat = function(times) {
   return (new Array(times + 1)).join(this);
};

define([
  'underscore',
  'backbone',
  'bipclient',
  ], function(_, Backbone, BipClient) {

    var BipModuleView = Backbone.View.extend({
      el: '#ui-container', // render widget to this container
      appID : 'ui', // identify bips created with this app

      container : null,
      router : null,

      obView : null,

      initialize : function() {
        var self = this;
        _.bindAll(
          this,
          'render'
        );
      },

      shutdown : function() {
      },

      // renders the app container
      render : function(mode, id) {
        var self = this,
          tplHTML = _.template($('#tpl-layouts-' + this.appID).html());

        this.container.html(tplHTML());

        this.test();
      },

      // !!!!!!!!!!!!!!!!!! implement injected view specific tests here
      test : function() {
                var templateStr = '',
          self = this;

        var schema = {
          bips : {
            name : "Schema 1",

            properties: {
              subject: {
                type: "string",
                description: "Subject"
              },

              arr : {
                type: "array",
                description: "List",
                items : {
                  description : "list object",
                  properties : {
                    label : {
                      name : "label",
                      "type" : "string",
                      "description" : "Arr Object Label"
                    }
                  }
                }
              },

              body: {
                type: "object",
                description: "Body Object",
                properties : {
                  label : {
                    "type" : "string",
                    "description" : "Obj Label"
                  }
                }
              }
            },

            definitions: { }
          },
          things : {
            name : "Thing",

            properties: {
              name: {
                type: "string",
                description: "Name"
              }
            },

            definitions: { }
          }
        };

        var $preview = $('#template-preview');


        templateStr = '[%bips.arr[3].label%]';

        // attach export templater (templar)
        $('#templar-test').templar2({
          delimiter : '#',
          template : '[%value%]',
          //tags : exports,
          schema : schema,
          data : '&nbsp;' + templateStr + '&nbsp;', // add buffer, trim on save
          select2 : self._select2Templar(),
          pasteMode : 'text'
        })
        .on('select2-loaded', function(ev) {
          var $el = $(this);
          $('.tooltip').remove();

          $('.select2-result-label .tooltippable').on('click', function() {
            $el.templar2('jsonMode', { 'source' : $(this).attr('data-cid') } );
          }).tooltip();
        })
        .on('templar-template', function(ev, template) {
          $preview.html(template);
        });
      },

      _getImageFromSource : function(src) {
        var self = this, imgSrc;

        if ('source' === src) {
          imgSrc = this.model.getIcon();

        } else if ('_client' === src) {
          return '<i class="icon-user"></i> ';

        } else if ('_bip' === src) {
          imgSrc = '/static/img/channels/32/color/bipio.png';

        } else {
          channel = BipClient.getCollection('channel').get(src);
          if (channel) {
            imgSrc = channel.getPod().getIcon();
          }
        }
        return imgSrc;
      },

      _select2Templar : function() {
        var that = this;

        return {
          formatResult : function(obj) {
            var  labelTxt = obj.text.length > 32 ? (obj.text.substr(0, 32) + '..') : obj.text;
            if (obj.children && obj.children.length) {
              var src = $(obj.element).attr('value'),
                imgSrc,
                imgSrc = that._getImageFromSource(src) || '';

              if (imgSrc) {
                if (-1 === imgSrc.indexOf('<')) {
                  imgSrc = '<img class="hub-icon hub-icon-16" src="' + imgSrc + '"> ';
                }
              }

              return imgSrc + labelTxt;

            } else {
              var offs = 0, prefix = '';
              try {
                var offs = parseInt(obj.css.match(/opt-level-\d/).pop().split('-').pop());
                prefix = '&nbsp;&nbsp;'.repeat(offs + 1);
              } catch (e) {
              }

              return prefix + labelTxt+ '<label class="label pull-right">' + $(obj.element).attr('data-type') + '</label>';
            }
          },

          formatSelection : function(obj) {
            var src = obj.id.split('#').shift(),
              tags = $(obj.element).parents('select:first').data('templar-tags'),
              imgSrc;

            // create index inputs for arrays
            var tokenPath = obj.id.split('.'),
              id = tokenPath.shift(),
              ptrId,
              jsPath = _.findWhere(tags, { id : id }),
              text = jsPath.text;

            if ('array' === jsPath.type && tokenPath.length > 1) {
              text += ' [<input data-path="' + obj.id + '" class="select2-subscript input input-mini" type="text" value=""/>]';
            }

            // skip object wrapper
            jsPath = jsPath.children[0];

            var ptrPath = id;

            while (tokenPath.length) {
              ptrId = tokenPath.shift();

              ptrPath += '.' + ptrId;

              // ptrId.match(/\[\d*\]/)
              if (jsPath.children) {
                jsPath = _.findWhere(jsPath.children, { id : ptrId });
                text += ' <i class="icon-chevron-right"></i> ' + jsPath.text;
                if ('array' === jsPath.type && tokenPath.length) {
                  text += ' [<input data-path="' + ptrPath + '" class="select2-subscript input input-mini" type="text" value=""/>]';
                }
              }
            }

            // legacy # splits and new '.' splits
            src = src.split('.').shift();

            imgSrc = that._getImageFromSource(src) || '';

            if (imgSrc) {
              if (-1 === imgSrc.indexOf('<')) {
                imgSrc = '<img class="hub-icon hub-icon-16" src="' + imgSrc + '"> ';
              }
            }

            return imgSrc + text;
          },

          escapeMarkup: function(m) {
            return m;
          },
          dropdownAutoWidth : true,
          placeholder: "Select an Attribute"
        }
      },

      appInfo : function(router, container) {
        var self = this,
          info = {
            name : this.appID,
            title : 'UI',
            ready : function(next) {
              // master route (router gobbles scope)
              router.route(self.appID, self.appID, function() {
                self.render.apply(self, arguments);
              });

              // ready!
              next();
            }
          };

        this.container = container;
        this.router = router;

        return info;
      }
    });

    return BipModuleView;
  });
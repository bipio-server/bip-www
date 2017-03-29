define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/pods/views/v_channel_config',
  'templar2'
  ], function(_, Backbone, BipClient, ChannelConfigView){

    TransformsView = Backbone.View.extend({

      tplModalTransform : _.template($('#tpl-bipio-transform-container').html()),

      tplModalConfigEntity : _.template($('#tpl-bipio-config-entity').html()),

      tplModalTransformEntity : _.template($('#tpl-bipio-transform-entity').html()),

      tplModalTransformEntityComp : _.template($('#tpl-bipio-transform-entity-composite').html()),

      model : null,

      _configView : null,

      _activeTransforms : null,

      initialize : function (el) {
        var self = this;
        _.bindAll(
          this,
          'render',
          'setTransforms',
          'applyPresets',
          '_renderProperty',
          '_select2Templar',
          '_getImageFromSource'
        );

        this.el = el;
        this.$el = $(el);

        self._configView = new ChannelConfigView();

        self._configView.on('attribute:rendered', function(attributeId, values) {
          if (undefined === self._activeTransforms[attributeId]) {
            self._activeTransforms[attributeId] = '';
          }

          var txVal = self._activeTransforms[attributeId];

          if (txVal.trim) {
            txVAl = txVal.trim();
          }

          var txEl = $('.control-label[for="import-' + attributeId + '"]').parent();

          self._toggleTransformMode(txEl, true);

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
          } else if (BipClient.find.pod(src)) {
            imgSrc = BipClient.find.pod(src).getIcon();
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
              jsPath,
              enumerate,
              text;

            if (!BipClient.isUUID(id) && id !== 'source' && 0 !== id.indexOf('_')) {
              id += '.' + tokenPath.shift();
              enumerate = tokenPath.shift();
              if (!/^_\d*$/) {
                tokenPath.unshift(enumerate);
              } else if (enumerate) {
                id += '.' + enumerate;
              }
            }

            jsPath = _.findWhere(tags, { id : id }),
            text = jsPath.text;
            //text = '';

            if ('array' === jsPath.type) {
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
                if ('array' === jsPath.type) {
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

          matcher : function(term, text, opt) {
            var $opt = $(opt),
              $parent = $(opt).parent(),
              searchText = text
                + ' '
                + $opt.attr('data-type')
                + ' '
                + $parent.attr('label')
                + ' '
                + $parent.attr('value');

            return searchText.toLowerCase().indexOf(term) != -1;
          },

          escapeMarkup: function(m) {
            return m;
          },
          dropdownAutoWidth : true,
          placeholder: "Select an Attribute"
        }
      },

      // toggles between config inherited mode, or transform override mode
      _toggleTransformMode : function(txEl, enableConfig) {
        var $custom = $('.transform-html', txEl),
          $customButton = $('.transform-config', txEl),
          $inheritButton = $('.transform-override', txEl),
          $inherit = $('.config-html', txEl),
          $selectedInput =  $('.templar.field',$custom),
          id = $('.templar.field',$custom).attr('id'),
          $label =  $('label[for^='+ id +']');

        $inherit.removeClass('blocked');
        $custom.removeClass('blocked');

        $inheritButton.removeClass('active');
        $customButton.removeClass('active');

        if (enableConfig) {
          $custom.addClass('blocked');
          $inheritButton.addClass('active');
          if(id){
        	  $selectedInput = $('#'+id.replace('import-','channel_'));
          }
        } else {
          $inherit.addClass('blocked');
          $customButton.addClass('active');
        }
        if($selectedInput.length > 0){
        	this.setValidation($selectedInput, $label);
        } else if ($inherit.length && $inherit.val) {
          this.setValidation($inherit, $label);
        }
      },

      _renderProperty : function(action, importProperty, exports, transforms, txFrom, channelJSON) {
        var templateStr,
          self = this,
          prop = action.imports.properties[importProperty],
          key = importProperty,
          required = (action.imports.required && -1 !== action.imports.required.indexOf(key)),
          txEl,
          configEl;

        this._activeTransforms = transforms = transforms || [];

        if (undefined === transforms[key] && prop && prop.default) {
          transforms[key] = prop.default
        }

        var description = prop.description;

        if (description) {
          // force links in descriptions into new tabs
          var $description = $('<span>' + prop.description + '</span>'),
            $links = $('a', $description);

          _.each($links, function(link) {
            $(link).attr('target', '_blank');
          });
          description = $description.html();
        }

        var txEl;

        // check for configurable
        if (action.config && action.config.properties) {

          config = action.config.properties[key];

          if (config) {

            var channelConfig = channelJSON;

            // sync channel and transforms.  transforms takes precedence
            if (transforms[key]) {
              channelConfig.config[importProperty] = transforms[key];
            } else if (channelConfig.config[importProperty]) {
              transforms[key] = channelConfig.config[importProperty];
            }

            self._configView._attachChannelOptions(
              this.action,
              channelConfig,
              action.name,
              this.pod.get('name'),
              [ key ]
            );

            txEl = $(
              self.tplModalTransformEntityComp({
                name : importProperty,
                description : description,
                title : prop.title,
                required : required,
                config : config
              })
            );

            // button group > radio bindings for view,
            // needs to be bound post render
            $('.btn-group button', txEl).on('click', function(ev) {
              $(this).siblings("input[type=hidden]").val($(this).attr('data-selection'));
            });
          }
        }

        if (!config) {
          txEl = $(
            self.tplModalTransformEntity({
              name : importProperty,
              description : description,
              title : prop.title,
              required : required
            })
          );
        }

        if (prop.type === 'text') {
          $('.templar', txEl).addClass('resize-vertical full-width');
        }

        $('.control-label', txEl).append('&nbsp;&nbsp;<label class="label">' + prop.type + '</label>');

        (function(txEl) {
          $('.transform-override,.transform-config', txEl).on('click', function(ev) {
            self._toggleTransformMode(txEl, !$(this).hasClass('transform-config'));
            return false;
          });
        })(txEl);

        templateStr = transforms[key];

        if (!templateStr) {
          templateStr = '';
        }

        templateStr = String(templateStr);

        var re = new RegExp('^\\[\\%\..*\\%\\]', "i");
        if(re.test(templateStr)) {
         	templateStr =  templateStr.replace(/#/g, '.');
         }

         templateStr = BipClient.htmlEncode(templateStr);

        // attach export templater (templar)
        $('.templar', txEl).templar2({
          delimiter : '#',
          template : '[%value%]',
          schema : exports,
          data : '&nbsp;' + templateStr + '&nbsp;', // add buffer, trim on save
          select2 : self._select2Templar(),
          pasteMode : 'text'
        }).on('select2-loaded', function(ev) {
          var $el = $(this);
          $('.tooltip').remove();
        });

        // -------------
        // setup channel/override toggles and set current state

        // figure out form transform whether it is an exact match against
        // a $ref'd enumerate, or explicit value.
        // if it's an unmatched enumerate then we should togle into transform mode
        // for the import
        var templateStrVal = templateStr.trim(),
          useConfig = false;

        if (this.pod.isValidEnum(action.name, 'imports', importProperty, templateStrVal)) {
          useConfig = true;

        } else if (action.imports.properties[importProperty]
          && 'boolean' === action.imports.properties[importProperty].type
          && BipClient.isBool(templateStrVal)
          ) {
          useConfig = true;
        } else if ('' === templateStrVal) {
          useConfig = true;
        }

        this._toggleTransformMode(txEl, useConfig);

        //$('.infotooltip').tooltip();

        return txEl;
      },
      setValidation:function($el ,$label) {
        var empty = (!$el.val().replace(/\s*/, ''));
        if (empty && $el.attr('data-template')) {
      	  	empty = (!$el.attr('data-template').replace(/\s*/, ''));
    	  }
        if (empty) {
        	$el.attr('empty', true);
        	$label.addClass('invalid');
        } else {
        	$el.removeAttr('empty');
        	$el.removeClass('invalid');
        	$label.removeClass('invalid');
        }
      },

      render : function(bipModel, channel, edgeParent, exports, parentIsSource) {

        var self = this,
          action,
          txBody,
          edgeParent,
          html,
          txTo = channel.get('action'),
          channelJSON = BipClient.realClone(channel.toJSON());

        this.model = bipModel;

        action = this.action = channel.getAction();
        this.pod = channel.getPod();

        channelJSON._action = this.action;

        this.$el.html(
          this.tplModalTransform(channelJSON)
        );

        edgeParent = parentIsSource ? 'source' : edgeParent;

        // hoist configrable items to the top of list
        var orderedProps = _.uniq(
          (action.config.disposition ? action.config.disposition : Object.keys(action.config.properties) )
          .concat(
          (action.imports.disposition ? action.imports.disposition : Object.keys(action.imports.properties) )
          ));

        for (var i = 0; i < orderedProps.length; i++) {
          html = this._renderProperty(
            action,
            orderedProps[i],
            exports || {},
            this.model.get('hub')[edgeParent].transforms
            && this.model.get('hub')[edgeParent].transforms[channelJSON.id]
              ? this.model.get('hub')[edgeParent].transforms[channelJSON.id]
              : {},
            edgeParent,
            channelJSON
          );
          this.$el.append(html);
        }

        $('.control-label[required]',  this.$el).each(function(idx,el) {
        	  // preset field
        	  var inputId = 'channel_' + $(el).attr('for').replace('import-', '');
        	  var item = $('#'+inputId);
        	  item.attr('required',true);
        	  item.bind('propertychange keyup input paste', function() {
        		  self.setValidation($(this) , $(el));
            });

	          // custom field
        	  var customId =  $(el).attr('for');
	        	var customField = $('#'+customId);

            customField.bind('templar-template', function() {
    	        self.setValidation($(this) , $(el));
    	      });
        });

        $('.add-templar-var', this.$el).click(function() {
          //$(arguments[0].currentTarget).siblings('.templar').focus().templar2('addTag');
          $('.templar', $(arguments[0].currentTarget).parent().parent()).focus().templar2('addTag');
          return false;
        });

        // perform validation pass
        this.setTransforms({}, [], true);

      },

      renderTrigger : function(bipModel, channel) {
        var self = this,
          action,
          txBody,
          edgeParent,
          html,
          txTo = channel.get('action'),
          config = bipModel.get('config'),
          channelJSON = BipClient.realClone(channel.toJSON());

        if (!config.config) {
          config.config = {};
        }

        this.model = bipModel;

        action = this.action = channel.getAction();
        this.pod = channel.getPod();

        channelJSON._action = this.action;

        this.$el.html(
          this.tplModalTransform(channelJSON)
        );

        for (var k in action.imports.properties) {
          html = this._renderTriggerProperty(
            action,
            k,
            config.config,
            channelJSON
          );
          this.$el.append(html);
        }

        BipClient.bindEmptyInputStyles(this.$el);

        // perform validation pass
        this.setTransforms({}, [], true);

        // bind validation

        $('.control-group [required]',  this.$el).each(function(idx,el) {
          // preset field
          var inputId = 'channel_' + $(el).attr('for').replace('config-', '');
          var item = $('#'+inputId);
          item.attr('required',true);

          item.bind('propertychange keyup input paste', function() {
            self.setValidation($(this) , $(el));
          });

          if (item.length) {
            self.setValidation($(item) , $(el));
          }

        });

      },

      _renderTriggerProperty : function(action, importProperty, transforms, channelJSON) {
        var templateStr,
          self = this,
          prop = action.imports.properties[importProperty],
          key = importProperty,
          required = (action.imports.required && -1 !== action.imports.required.indexOf(key)),
          txEl,
          configEl;

        this._activeTransforms = transforms = transforms || [];

        if (undefined === transforms[key] && prop.default) {
          transforms[key] = prop.default
        }

        var description = prop.description;

        if (description) {
          // force links in descriptions into new tabs
          var $description = $('<span>' + prop.description + '</span>'),
            $links = $('a', $description);

          _.each($links, function(link) {
            $(link).attr('target', '_blank');
          });
          description = $description.html();
        }

        var txEl;

        // check for configurable
        if (action.config && action.config.properties) {

          config = action.config.properties[key];

          if (config) {

            var channelConfig = channelJSON;

            // sync channel and transforms.  transforms takes precedence
            if (transforms[key]) {
              channelConfig.config[importProperty] = transforms[key];
            } else if (channelConfig.config[importProperty]) {
              transforms[key] = channelConfig.config[importProperty];
            }

            self._configView._attachChannelOptions(
              this.action,
              channelConfig,
              action.name,
              this.pod.get('name'),
              [ key ]
            );

            txEl = $(
              self.tplModalConfigEntity({
                name : importProperty,
                description : description,
                title : prop.title,
                required : required,
                config : config
              })
            );

            // button group > radio bindings for view,
            // needs to be bound post render
            $('.btn-group button', txEl).on('click', function(ev) {
              $(this).siblings("input[type=hidden]").val($(this).attr('data-selection'));
            });
          }
        }

        //$('.infotooltip').tooltip();

        return txEl;
      },

      setTransforms : function(transforms, err, indicatorPass) {
        var self = this,
          item,
          label,
          configForm = self._configView.serialize(this.el).config,
          configs = $('.config-html div[id^=channel]',this.$el);

        if (!configForm) {
          configForm = {};
        }

        _.each(configForm, function(value, key) {
          transforms[key] = value;
        });

        _.each(configs, function(value, key, el){
          var id, val,
            $el = $(el[key]);

          id = $el.attr('name').replace('config#', '');
          if ($el.hasClass('select2-offscreen')) {
            val = $el.select2('val');
          } else {
            val = $(value).attr('data-template');
          }

          configForm[id] = val;
        });

        $('div[id^=import],[name^=config]', this.$el).each(function(idx, el) {
          var $el = $(el),
            importId;

          if ($el.attr('id')) {
            importId = $el.attr("id").replace(/import-|channel_/, '');
          } else {
            return;
          }

          if ($el.parent().hasClass('blocked') || $el.parent().parent().hasClass('blocked')) {

            if (importId && configForm[importId]) {
              transforms[importId] = configForm[importId];
           }

          } else if ($el.hasClass('templar')) {
            $el.templar2('computeTemplate');
            template = $el.attr('data-template');

            if (template && '' !== template) {
              transforms[importId] = $el.attr('data-template').trim();
            }
          }

          label = $('label[for="' + $el.attr("id") + '"]');

          if ( label.attr('required') || $el.parent().attr('required') || $el.attr('required') ) {

        	  item = $el;
        	  if ($el.parent().hasClass('blocked')) {
        		 item = $('#channel_'+importId, self.el)
        	  }

             // check local or compound inputs

        	  if (item.attr('empty') == 'true' || item.parent().attr('empty') === 'true') {
              if (!indicatorPass) {
         		   item.addClass('invalid');
              }
       		    label.addClass('invalid');
        		  err.push($('label[for="' + $el.attr("id") + '"]').text());

        	   } else{
        		   label.removeClass('invalid');
        	   }
          }

        });

        if (err.length) {
          // scroll to first error
          var $modal = this.$el.parent(),
            $targetEl = $('.templar.invalid:first', this.$el).parents('.control-group:first');

          if ($targetEl.length) {
            $modal.animate({
              scrollTop: $targetEl.offset().top - $modal.offset().top + $modal.scrollTop()
            });
          }

          self.trigger('transform:invalid');

          return;
        } else {

        }
      },

      applyPresets : function(cid) {
        var self = this,
          config,
          channel;

        if (BipClient.isUUID(cid)) {
          channel = BipClient.find.channel(cid);
          if (channel) {
            config = channel.get('config');

            self._configView._updateChannelOptions(channel);

            // force preset selection
            if (config) {
              _.each(config, function(value, key) {
                if (value) {
                  $('#group-' + key + ' .transform-override').click();
                }
              });
            }
          }
        }

        BipClient.bindEmptyInputStyles(this.$el);

      },

      getForm : function() {
        var transforms = {},
          err = [];

        this.setTransforms(transforms, err);

        // @todo raise validation errors
        return transforms;
      }
    });

    return TransformsView;
  });
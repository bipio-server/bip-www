define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/pods/views/v_channel_renderers',
  ], function(_, Backbone, BipClient, RenderersView){
    // Individual Domain
    var DomainAdminView = Backbone.View.extend({
      el : $('#domain-ctl'),
      tpl : null,
      events: {
        "click #domain-name-new-btn" : "publish",
        "click .btn-verify" : "verify",
        "click .btn-delete" : "remove",
        'click .select-renderer button' : 'selectRenderer',
        'click .btn-remove-renderer' : 'selectRenderer',
      },
      initialize: function(){
    	this.tpl = _.template($('#tpl-domain-entity').html());
        _.bindAll(
          this,
          'render',
          'renderRow',
          'appendRow',
          'errTranslate',
          'remove',
          'removeRow',
          'updateRow',
          'publish',
          'patchRender',
          'verify'
        );
        this.collection.bind('reset', this.render);
      },
      renderRow : function(domain) {
        var struct = domain.toJSON(), html;
        struct.mode = domain.get('_available') ? 'verified' : 'unverified';

        if (/bip.io$/i.test(struct.name)) {
          struct.mode = 'system'
        }

        if (struct.mode == 'verified') {
          struct.alert_mode = 'success';

        } else if (struct.mode == 'unverified') {
          struct.alert_mode = 'warning';

        } else {
          struct.alert_mode = 'info';
        }

        return this.tpl(struct);
      },
      updateRow : function(domain) {
        var innerHTML = $('.well', this.renderRow(domain));
        $('#domain-entity-' + domain.id).html(innerHTML);
      },
      removeRow : function(domain) {
        $('#domain-entity-' + domain.id).remove();
      },

      appendRow : function(domain) {
        var self = this;

        domain.rendererChannels = this.rendererChannels;

        var domainJSON = domain.toJSON();

        var el = $('#domain-list', this.el),
        $row = $(this.renderRow(domain));

        el.append($row);

        // add renderers
        var renderersView = new RenderersView(
          '#collapse-' + domain.id + ' .domain-renderers',
          '#domain-entity-' + domain.id
          );

        renderersView.on('renderer:add', function(renderer) {

          var domainId = $(this.el).parents('.accordion-group').attr('data-domain-id');
          var domain = self.collection.get(domainId);

          var renderer = renderer;

          domain.set('renderer', renderer);

          self.patchRender(domain);
        });

        renderersView.on('renderer:remove', function() {
          var domainId = $(this.el).parents('.accordion-group').attr('data-domain-id');
          var domain = self.collection.get(domainId);

          domain.set('renderer', {});

          self.patchRender(domain);

        });

        if (domainJSON.renderer) {
//          renderersView.render(domainJSON.renderer.channel_id, domainJSON.renderer.renderer);
          renderersView.render(domainJSON.renderer);
        } else {
          renderersView.render();
        }
      },

      patchRender : function(domain) {
        var domainJSON = domain.toJSON();

        domain.save(
          {
            renderer : domainJSON.renderer ? domainJSON.renderer : {}
          },
          {
            patch : true,
            wait : true,
            success : function(model) {
              BipClient.growl('Renderer Saved for ' + model.get('_repr'));
            },
            error : function(model, response) {
              BipClient.growl(model.get('_repr') + ' ' + response, 'error');
            }
          }
        );
      },

      render: function(){
        var self = this;

        this.rendererChannels = BipClient.getCollection('channel').getRenderable(true);

        $('#domain-list', this.$el).empty();

        this.collection.models.forEach( function (domain) {
          self.appendRow(domain);
        });
        return this;
      },

      // translates from a model attribute to form, and renders an error
      errTranslate: function(isErr, error) {
        var el = $('#domain-name-new', this.el).parent();
        if (isErr) {
          el.parent().addClass('error');
          el.children('.help-block').html(error);
        } else {
          el.parent().removeClass('error');
          el.children('.help-block').html('');
        }
      },
      publish : function(ev) {
        var domainName = $('#domain-name-new').val(),
        el = $(this.el),
        self = this,
        model;

        ev.preventDefault();
        this.errTranslate(false);

        if ('' == domainName) {
          this.errTranslate(true, 'Can not be empty');
        } else {
          // create domain
          model = this.collection.newModel();
          model.set('name', domainName);
          model.save(
            model.toJSON(),
            {
              silent  : false,
              sync    : false,
              success : function(model, res, xhr) {
                var available = model.get('_available');

                if (!available) {
                  BipClient.growl('Domain Saved - Verification Required', 'error');
                } else {
                  BipClient.growl('Domain Saved');
                }
                self.collection.push(model);
                self.appendRow(model);
                $('#domain-name-new').val('');
              },
              error: function(model, res) {
                // conflict
                if (res.status === 409) {
                  self.errTranslate(true, 'This domain is unavailable');

                // handle general errors
                } else {
                  var errStruct = BipClient.errParse(res),
                  msg = (errStruct.msg) ? errStruct.msg : 'Unknown Error';

                  self.errTranslate(true, msg);
                }
              }
            });
        }
      },
      verify : function(ev) {
        var src = $(ev.currentTarget),
        id = src.attr('data-model-id'),
        model = this.collection.get(id),
        self = this;

        ev.preventDefault();
        ev.stopPropagation();

        model.rpcVerify(function(err, domain) {
          var available = domain.get('_available');
          if (!err) {
            if (available) {
              self.updateRow(domain);
            } else {
              BipClient.growl(domain.get('name') + ' failed verification', 'error');
            }
          } else {
            console.log(err);
            BipClient.growl('An error occurred', 'error');
          }
        });
      },
      remove : function(ev) {
        var src = $(ev.currentTarget),
        id = src.attr('data-model-id'),
        model = this.collection.get(id),
        self = this;

        ev.preventDefault();
        model.destroy({
          success : function(domain, response) {
            self.removeRow(domain);
            BipClient.growl('Domain Deleted');
          },
          error : function(model, response) {
            console.log(reponse);
          }
        });
      }
    });

    return DomainAdminView;
  });

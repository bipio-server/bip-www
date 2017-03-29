/**
 *
 * BipIO graphs app
 *
 */
define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/bipio/views/v_bip_list',
  'apps/bipio/views/v_bip_edit'
  ], function(_, Backbone, BipClient, BipListView, BipEditView) {

    var BipModuleView = Backbone.View.extend({
      el: '#bipio-container', // render widget to this container
      appID : 'bipio', // identify bips created with this app

      tplLanderWidget: _.template( $('#tpl-bipio-lander').html() ), // lander layout
      tplEditWidget: _.template( $('#tpl-bipio-edit').html() ), // edit layout

      container : null,
      router : null,

      modalView : null,

      bipListView : null,

      initialize : function(router, container) {
        var self = this;
        _.bindAll(
          this,
          'render',
          'shutdown'
        );

        this.container = container;
        this.router = router;

        this.deleteModal = $('#bipio-delete-modal');

        $('.btn-success', this.deleteModal).on('click', function() {
          self.deleteModal.modal('hide');

          var model = BipClient.find.bip($(this).attr('data-bip-id'));
          model.destroy({
            success : function(model, response) {
              BipClient.growl('Bip <strong>' + model.get('name') + '</strong> Deleted');
              if ('bipio' === Backbone.history.getFragment()) {
                self.render.apply(self);
              } else {
                self.router.navigate('bipio', { trigger : true });
              }
            },
            error : function(model, response) {
              console.log(response);
            }
          });
        });
      },

      shutdown : function() {
        if (this.modalView) {
          this.modalView.shutdown();
        }
      },

      // renders the app container
      render : function(id, mode, childId) {
        var self = this,
          tplHTML = _.template($('#tpl-layouts-' + this.appID).html());

        if (this.modalView) {
          this.modalView.shutdown();
        }

        this.container.html(tplHTML());

        // edit/create mode
        if (id) {
          //

          $(this.el).html(this.tplEditWidget());

          this.modalView = new BipEditView(this.router);
          this.modalView.render(id, mode, childId);

        // lander mode
        } else {

          $(this.el).html(this.tplLanderWidget({ bip_count : BipClient.getCollection('bip').length }));

          // render list into lander container
          this.bipListView = new BipListView(
            $('#bip-list-container', this.container),
            this.router
          );

          // replace button copy
          if (BipClient.bipsExceedPlan()) {
            $('#bip-create > a').html(
              '<i class="icon-plus-sign"></i> Upgrade Now To Create More Bips'
            );
/*
            .on('click', function() {
              BipClient.selectPlanRoute('num_bips');
              return false;
            });
*/
          }


          this.bipListView.render();
        }

      },

      appInfo : function(router, container) {
        var self = this,
          initArgs = arguments,
          info = {
            name : this.appID,
            title : 'My Bips',
            ready : function(next) {
              // master route (router gobbles scope)
              router.route(self.appID, self.appID, function() {
                self.render.apply(self, arguments);
              });

              router.route(self.appID + '/:id', self.appID, function() {
                self.render.apply(self, arguments);
              });

              router.route(self.appID + '/:id/:mode/:child_id', self.appID, function() {
                self.render.apply(self, arguments);
              });

              router.route(self.appID + '/:id/:mode', self.appID, function() {
                self.render.apply(self, arguments);
              });

              self.initialize.apply(self, initArgs);

              // ready!
              next();
            },
            shutdown : function() {
              self.shutdown.apply(self, arguments);
            }
          };

        this.container = container;
        this.router = router;

        return info;
      }
    });

    return BipModuleView;
  });
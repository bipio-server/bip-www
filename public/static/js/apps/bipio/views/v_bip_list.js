define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/bipio/views/v_bip_share',
  ], function(_, Backbone, BipClient, BipShareView){

    var BipListView = Backbone.View.extend({
      el: '#bip-list-widget',

      tplWidget: _.template( $('#tpl-bipio-list').html() ), // widget container

      tplListEntity :  _.template( $('#tpl-bipio-list-entity').html() ), // list entity
      tplListEntityCompact :  _.template( $('#tpl-bipio-list-entity-compact').html() ), // list entity
      tplBipPreview :  _.template( $('#tpl-bipio-bip-preview').html() ), // preview element

      tplPaginate :  _.template($('#tpl-pagination').html()), // paginator

      _router : null,

      _activeModal : null,

      events : {
        'click .pause-action' : 'pauseAction',
        'click .share-action' : 'shareAction',
        'click .dup-action' : 'dupAction',
        'click .test-action' : 'testAction',
        'click .edit-action' : 'editAction',
        'click .delete-action' : 'deleteAction',
        'click .trigger-action' : 'triggerAction',
        'click .error-action' : 'logsAction'
      },

      initialize: function(container, router) {
        var self = this;
        _.bindAll(
          this,
          'renderRows',
          'next',
          'previous',
          'search'
        );

        this.collection = BipClient.getCollection('bip'); //new BipCollection();
        this.collection.bind('reset', this.renderRows);

        this.el = $(this.el, container)
        this._router = router;

        this.container = container;

        this.deleteModal = $('#bipio-delete-modal');
      },

      render: function(compact, filteredCollection) {
        var tpl = this.tplWidget(),
          self = this;

        this.el.html(tpl);

        self.renderRows(null, null, compact, filteredCollection);

        $('#bip-search-form').val(BipClient.getCollection('bip').searchBy);
        $('#bip-search-form').on('keyup', self.search);
      },

      // renders result rows and pagination
      renderRows: function(collection, xhr, compact, filteredCollection) {
        var listContainer,
          listBip,
          listPaginate,
          self = this,
          el = $(this.el),
          channels = BipClient.getCollection('channel'),
          bips = filteredCollection || this.collection.getFilteredModels(),
          channel,
          start = 0,
          end;

        listContainer = $('#list-bip-container', el); // list container

        var $listCnt = $('#list-control'),
          $listHlp = $('#list-helper');

        if (!this.collection.length) {
          $listCnt.hide();
          $listHlp.show();
        } else {
          $listCnt.show();
          $listHlp.hide();
        }

        // render list
        listBip = $('#bip-list', listContainer);
        listBip.empty();

        if (!compact) {
          start = (this.collection.page - 1) * this.collection.page_size,
          end = start + this.collection.page_size;
        }

        bips.slice(start, end).forEach( function (bip) {
          var bipJSON = BipClient.deepClone(bip.toJSON());

          var $listEntity;

          bipJSON.baseRoute = self.baseRoute;

          // normalize expiry repr
          if (bipJSON.end_life && bipJSON.end_life.time) {
            var convTime = bipJSON.end_life.time * 1000;
            if (!isNaN(convTime)) {
              bipJSON.end_life.time = convTime;
            }
          }

          if (compact) {
            $listEntity = $(self.tplListEntityCompact(bipJSON));
          } else {
            $listEntity = $(self.tplListEntity(bipJSON));
          }

          $('.bip-preview', $listEntity).html(self.tplBipPreview(bip.getManifest(true, 8)));

          listBip.append( $listEntity );
        });

        $('.bip-list-item').removeClass('defocused');

        if (!compact) {
          listPaginate = $('.bip-list-pagination', this.container);
          listPaginate.html(self.tplPaginate(self.collection.pageInfo()));

          $('a.prev', listPaginate).on('click', this.previous);
          $('a.next', listPaginate).on('click', this.next);
        }

        $('.tooltipped').tooltip();
      },

      // ---------- ACTION CONTROLS

      pauseAction : function(ev) {
        var $btn = $(ev.currentTarget),
          action = $btn.attr('data-action'),
          self = this,
          id = $btn.closest('.bip-select').attr('data-model-id'),
          bip = this.collection.get(id);

        // patch
        $btn.button('loading');

        bip.save({
          paused : (action == 'play') ? false : true
        }, {
          patch : true,
          success : function() {
            $btn.button('reset');
            BipClient.growl('<strong>' + bip.get('name') + '</strong> is ' + ((action === 'play') ? 'Active' : 'Paused'));
            self.renderRows();
          }
        });
      },

      shareAction : function(ev) {
        var self = this,
          id = $(ev.currentTarget).closest('.bip-select').attr('data-model-id'),
          bip = this.collection.get(id);

        var sView = new BipShareView();

        sView.share(bip);
      },

      dupAction : function(ev) {
        var id = $(ev.currentTarget).closest('.bip-select').attr('data-model-id');

        this._router.navigate('/bipio/' + id + '/dup', { trigger : true });
      },

      editAction : function(ev) {
        var id = $(ev.currentTarget).closest('.bip-select').attr('data-model-id');

        this._router.navigate('/bipio/' + id , { trigger : true });
      },

      logsAction : function(ev) {
        var id = $(ev.currentTarget).closest('.bip-select').attr('data-model-id');

        this._router.navigate('/bipio/' + id + '/logs', { trigger : true });
      },

      testAction : function(ev) {
        var id = $(ev.currentTarget).closest('.bip-select').attr('data-model-id');
        this._router.navigate('#outbox/test/' + id, { trigger : true });
      },

      triggerAction : function(ev) {
        var id = $(ev.currentTarget).closest('.bip-select').attr('data-model-id');
        BipClient.triggerBip(id);
      },

      deleteAction : function(ev) {
        var id = $(ev.currentTarget).closest('.bip-select').attr('data-model-id');

        $('.btn-success', this.deleteModal).attr('data-bip-id', id);

        this.deleteModal.modal();
        BipClient.centerModal($('.modal', this.deleteModal) );
      },

      // -------- PAGINATION

      previous: function(ev) {
        ev.preventDefault();
        if ($(ev.currentTarget).hasClass('disabled')) {
          return;
        }
        this.collection.prevPage();
        this.renderRows();
        return false;
      },

      next: function(ev) {
        ev.preventDefault();
        if ($(ev.currentTarget).hasClass('disabled')) {
          return;
        }
        this.collection.nextPage();
        this.renderRows();
        return false;
      },

      search : function(ev) {
        var searchStr = $(ev.currentTarget).val();
        this.collection.search(searchStr);
        this.renderRows();
      },
    });

    return BipListView;
  });
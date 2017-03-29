/**
 *
 * Shared Bips list
 *
 */
define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/pods/views/v_channel_pod_list',
  'apps/pods/views/v_channel_config',
  'apps/community/views/v_bip_auth_config',
  'models/m_bip_share',
  ], function(_, Backbone, BipClient, PodListView, ChannelConfigView, BipAuthConfigModal, BipShareModel){

    //
    BipSharedView = Backbone.View.extend({
      el: '#bip-setup',

      tplSharedContainer : _.template($('#tpl-community-bips').html()),
      tplSharedEntity : _.template($('#tpl-community-shared-entity').html()),
      tplBipPreview :  _.template( $('#tpl-bipio-bip-preview').html() ), // preview element
      tplPaginate :  _.template($('#tpl-pagination').html()), // paginator
      tplActionEntity : _.template($('#tpl-action-entity').html()),

      tplEmbedCode : _.template($('#tpl-community-embed-code').html()),
      tplLoader :  _.template($('#tpl-loader').html()),

      manifestPending : [],
      manifestDup : {},
      manifestResolved : {},
      shareModal : null,
      podSetupView : null,
      channelConfigView : null,

      _configStep : false,

      _activeChannel : null,
      _activeShare : null,
      channelQueue : {},
      channelConfigs : {},

      //tplModal : _.template($('#tpl-modal-share-setup').html()),
      channelSelectView : null,
      hubView : null,
      events: {
        'click button' : 'buttonClick',
        'click a.prev' : 'previous',
        'click a.next' : 'next'
      },
      initialize:function () {
        var self = this;
        _.bindAll(
          this,
          'render',
          'renderRows',
          'previous',
          'next',
          'buttonClick',
          'setShare',
          'getShare',
          'installShare',
          '_normalizeTransform'
          );

        this.collection = BipClient.getCollection('bip_shares');
        this.collection.bind('reset', this.renderRows);

        this.podSetupView = new PodListView();
        this.channelConfigView = new ChannelConfigView();

        this.embedModal = $('#community-embed-modal');
      },

      setShare : function(id, next) {
        this._activeShare = this.collection.get(id);
        if (true || !this._activeShare) {
          this._activeShare = new BipShareModel({id: id});
          this._activeShare.fetch({
            success : function(model) {
              this._activeShare = model;
              if (model.get('manifest')) {
                next();
              } else {
                BipClient.growl('Share Could Not Be Found', 'warning');
              }
            },
            error : function() {
              BipClient.growl('Share Could Not Be Found', 'warning');
            }
          });
        } else {
          next();
        }
      },

      getShare : function() {
        return this._activeShare;
      },

      // TODO: split this fn into render & renderRows (following pattern in v_bip_list.js)

      render : function() {
        var self = this;

        this.$el.html(this.tplSharedContainer({
          smtp_enabled : BipClient.getCollection('bip_descriptions').findWhere({ id : 'smtp' }),
          emitters : BipClient.getCollection('channel').getEmitters()
        }));

        $('#shared-bip-search-form', self._container).on('keyup', (function() {
          var timer;
          return function() {
            var val = this.value;
            clearTimeout(timer);
            timer = setTimeout(function() {
              $('.list-bips', self.$el).append($('.roto', self.tplLoader()));
              BipClient.getCollection('bip_share').search(val);
            }, 300);
          }
        })());

        this.renderRows();
      },


      renderRows : function() {
        var dict,
        tokens,
        pods = BipClient.getCollection('pod'),
        action,
        self = this,
        icoTypePfx = '/static/img/channels/32/color/bip_',
        skipManifest;

        var $el = $('.list-bips', self.$el),
          $listEntity;

        $el.empty();

        for (var i = 0; i < self.collection.models.length; i++) {
          dict = self.collection.models[i].toJSON();
          dict.type_description = '';
          dict.type_icon = dict.icon ? dict.icon : icoTypePfx + dict.type + '.png';

          switch (dict.type) {
            case 'http' :
              dict.type_description = 'HTTPS Endpoint';
              break;
            case 'smtp' :
              dict.type_description = 'Email Address';
              break;
            case 'trigger' :
              skipManifest = dict.config.channel_id;
              tokens = dict.config.channel_id.split('.');
              action = pods.get(tokens[0]).get('actions')[tokens[1]]
              dict.type_description = 'Event Source - ' + action.description;
              if (dict.config && dict.config.config && dict.config.config.icon) {
                dict.type_icon = dict.config.config.icon;
              } else if (dict.config && dict.config.icon) {
                dict.type_icon = dict.config.icon;
              } else {
                dict.type_icon = self.collection.models[i].getIcon();
              }
              break;
            default :
              break;
          }


          dict.normedManifest = [];
          // normalize actions
          for (var j = 0; j < dict.manifest.length; j++) {
            if (dict.manifest[j] !== 'source' && skipManifest !== dict.manifest[j]) {
              tokens = dict.manifest[j].split('.');
              if (true || 'flow' !== tokens[0]) {
                action = pods.get(tokens[0]).get('actions')[tokens[1]];
                dict.normedManifest.push({
                  pod : tokens[0],
                  action : tokens[1],
                  icon : pods.get(tokens[0]).getIcon(tokens[1]),
                  title : action.title,
                  description : action.description || '',
                });
              }
            }
          }

          dict = BipClient.distributeManifest(dict, 8);

          $listEntity = $(self.tplSharedEntity(dict));

          // create preview
          $('.bip-preview', $listEntity).html( self.tplBipPreview(dict) );

          $el.append($listEntity);
        }

        $('.bip-select-info a').click(function() {
          var shareId = $(this).attr('data-share-id');

          self.setShare(shareId, function() {
            self.installShare();
          });

          return false;
        });

        listPaginate = $('.shared-list-pagination');
        listPaginate.html(self.tplPaginate(self.collection.pageInfo()));

        $('a.prev', listPaginate).on('click', this.previous);
        $('a.next', listPaginate).on('click', this.next);
      },

      previous: function(ev) {
        ev.preventDefault();
        if ($(ev.currentTarget).hasClass('disabled')) {
          return;
        }
        this.collection.prevPage();
        return false;
      },

      next: function(ev) {
        ev.preventDefault();
        if ($(ev.currentTarget).hasClass('disabled')) {
          return;
        }
        this.collection.nextPage();
        return false;
      },

      _actionTranslate : function(action) {
        return BipClient.getCollection('channel').getChannelJSONAction(action.replace('-', '.'));
      },

      // given a template denormalized by pod action, tries to interpolate channel id's
      _normalizeTransform : function(template) {
        return template;
      },

      installShare : function() {
        var self = this;
        this.shareInstallModal = new BipAuthConfigModal(this.getShare());
        this.shareInstallModal.on('shared-install', function(share, id) {
          self.shareInstallModal.close();
          delete self.shareInstallModal;

          self.trigger('shared-install', share, id);
        });

        this.shareInstallModal.render();
      },

      buttonClick : function(ev) {
        var src = $(ev.currentTarget),
          type = src.attr('data-action'),
          self = this,
          shareId = src.closest('.bip-select').attr('data-model-id'),
          share = self.collection.get(shareId),
          shareName = share.get('name');

        if (type === 'install') {
          this.setShare(shareId, function() {
            self.installShare();
          });

        } else if (type === 'uninstall') {
          BipClient.unShare(shareId, function(err, resp) {
            if (err) {
              BipClient.growl(resp || 'Could Not Un-Share', 'error');
            } else {
              BipClient.growl(shareName + ' Is No Longer Shared');
            }
            self.collection.fetch({
              reset : true
            });
          });
        } else if (type === 'embed') {
          // can't inject <script into templates, so using embedscript placeholder
          var tpl = this.tplEmbedCode({ shareId : shareId }).replace(/embedscript/g, 'script');
          $('#share-embed-code', this.embedModal).val(tpl);

          $('#share-embed-slug', this.embedModal).val(
            self.collection.slugURL(share.id)
          );

          this.embedModal.modal();
          BipClient.centerModal( $('.modal', this.embedModal) );
        }
      }
    });

    return BipSharedView;
  });

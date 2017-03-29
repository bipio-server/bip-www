
define([
  'underscore',
  'backbone',
  'bipclient',
  'c_pod',
  'apps/bipio/collections/c_action_searchable_collection'
  ], function(_, Backbone, BipClient, Pods, ActionsCollection ){

    var ChannelListView = Backbone.View.extend({
      el: '#channel-list-widget', // render widget to this container
      tplWidget: _.template( $('#tpl-resource-list-channel').html() ), // widget container
      tplListEntity :  _.template( $('#tpl-bipio-list-channel-entity').html() ), // list entity

      tplListTitle :  _.template( $('#tpl-bipio-list-title').html() ), // list entity

      tplPaginate :  _.template($('#tpl-pagination').html()), // paginator

      _container : null,
      modalView : null,
      filter : null,
      _filterContext : null,

      channelCollection : null,
      podCollection : null,

      searchType : 'actions',

      initialize: function(container, targetEl, searchType, exclusions) {
        var self = this;
        _.bindAll(
          this,
          'renderRows',
          'next',
          'previous',
          'resetPage',
          'sort',
          'delay',
          'search',
          'modalOpen',
          'updateFilter',
          'setFilterContext',
          'setSearchExclusions'
        );

        this._container = container;

        if (targetEl) {
          this.el = targetEl;
        }

        this.collection = new ActionsCollection();
        this.collection.setSearchType(searchType);
        this.searchType = searchType;
      },

      // renders the list container
      render: function(container) {

    	if(container)
    		this._container = container;
        
    	var el = $(this.el, this._container),
        tpl = this.tplWidget(),
        self = this;

        el.html(tpl);

        $('#channel-search-form', this._container).on('keyup', function() {
          self.search($(this).val());
        });

        $('.dropdown-toggle').dropdown();
        this.renderRows();

        $('#channel-search-form').val(BipClient.getCollection('channel').searchBy);
      },

      // renders result rows and pagination
      renderRows: function() {
        var listContainer,
          listChannel,
          listPaginate,
          self = this,
          el = $(this.el, this._container),
          channelJSON,
          channels,
          searchTypeLabel = 'actions' === this.searchType ? 'Actions' : 'Events',
          start = (this.collection.page - 1) * this.collection.page_size,
          end = start + this.collection.page_size;

        listContainer = $('#list-channel-container', el); // list container

        // render list
        listChannel = $('#channel-list', listContainer);
        listChannel.empty();

        channels = this.collection.getFilteredModels(true);
        
        var savedChunk = false,
          availableChunk = false;

        channels.slice(start, end).forEach( function (item) {
          channelJSON = item.toJSON();
          actionTokens = channelJSON.action.split('.');
          channelJSON.pod = actionTokens[0];

          channelJSON.podContext = false;

          channelJSON.icon = item.getIcon(actionTokens[1]);
          listChannel.append( self.tplListEntity(channelJSON));
        });

        var clHeader = $('.channel-list h2');

        clHeader.html(this._filterContext
          ? ('<img class="hub-icon hub-icon-32" src="' + this._filterContext.getIcon() + '"/> ' + this._filterContext.get('title'))
          : ('All Configured Channels')
        );

        // update pagination controls in list (parent) container
        listPaginate = $('.channel-list-pagination', this._container);
        listPaginate.html(self.tplPaginate(self.collection.pageInfo()));

        $('a.prev', this._container).on('click', this.previous);
        $('a.next', this._container).on('click', this.next);

        $('.channel-list-item a').on('click', function(ev) {
          ev.preventDefault();
        });

        $('.create-action button').on('click', function(ev) {
          ev.preventDefault();
//          self.trigger('view:addAction', $(this).attr('data-add-action') );
          self.trigger('view:addAction', $(this).siblings('a').attr('data-action') );
        });

        this.trigger('view:rendered');
      },

      updateFilter : function(filter, selectedChannel) {
        this.collection.updateFilter(filter);
        this.renderMergedRows();
      },

      setFilterContext : function(context) {
        this._filterContext = context;
      },

      resetPage : function() {
        this.collection.resetPage();
      },

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

      sort: function(ev) {
        var sortBy = ev.currentTarget.getAttribute('data-sort'),
        orderOptions;

        $('[data-toggle="dropdown"]').parent().removeClass('open');

        // update 'active'
        orderOptions = $('#channel-order').children('li');
        orderOptions.each(function() {
          var self = $(this);

          self.removeClass('active');

          if (self.attr('data-sort') == sortBy) {
            self.addClass('active');
          }

          $('#channel-order-by-label', this.el).html(
            $(ev.currentTarget).children('a').html()
            );

        });

        this.collection.sort(sortBy);
        return false;
      },

      modalOpen : function(ev) {
        alert('not yet');
        return;
        ev.preventDefault();
        var src = $(ev.currentTarget),
        target = src.attr('data-modal'),
        channelType = src.attr('data-channel-type'),
        id = src.attr('data-model-id'),
        model;

        // @todo ? backbone bug ? defaults are overriding the constructor?
        model = id ? this.collection.get(id) : new MBip( {
          type : channelType
        } );

        this.modalView.model = model;
        this.modalView.render();

        $('.dropdown-toggle').dropdown();
      },

      delay: (function() {
        var timer = 0;
        return function(callback, ms){
          clearTimeout (timer);
          timer = setTimeout(callback, ms);
        };
      })
      (),

      search : function(searchStr) {
        this.collection.search(searchStr);
        this.renderRows();
      },

      setSearchExclusions : function(excludedCids) {
        this.collection.setSearchExclusions(excludedCids);
      }
    });

    return ChannelListView;
  });
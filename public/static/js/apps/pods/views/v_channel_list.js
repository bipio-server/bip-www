
define([
  'underscore',
  'backbone',
  'bipclient',
  'c_pod',
  ], function(_, Backbone, BipClient, Pods ){

    var ChannelListView = Backbone.View.extend({
      el: '#channel-list-widget', // render widget to this container
      tplWidget: _.template( $('#tpl-resource-list-channel').html() ), // widget container
      _enableWidgetWrapper : true,
      tplListEntity :  _.template( $('#tpl-list-channel-entity').html() ), // list entity

      tplPaginate :  _.template($('#tpl-pagination').html()), // paginator

      _container : null,
      modalView : null,
      filter : null,
      clickHandler : null,
      _filterContext : null,

      initialize: function(container, router, targetEl, useWidget, searchType, exclusions, clickHandler) {
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
          'updateFilter',
          'setFilterContext'
          );

        this.collection = BipClient.getCollection('channel'); //new BipCollection();
        if (searchType !== 'any') {
          this.collection.setSearchType(searchType);
        }

        this.collection.setSearchExclusions(exclusions);
        this.collection.searchBy = null;

        this.collection.bind('reset', function(item, result) {
          self.renderRows();
        });

        this._container = container;

        if (targetEl) {
          this.el = targetEl;
        }

        if (undefined !== useWidget) {
          this._enableWidgetWrapper = useWidget;
          this.collection.page_size = 9;
        }

        if (clickHandler) {
          this.clickHandler = clickHandler;
        }
      },

      // renders the list container
      render: function() {
        var el = $(this.el, this._container),
        tpl = this.tplWidget(),
        self = this;

        if (this._enableWidgetWrapper) {
          el.html(tpl);
        }

        $('#channel-search-form', this._container).on('keyup', function() {
          self.search($(this).val());
        });

        $('.dropdown-toggle').dropdown();
        this.renderRows();

        $('#channel-search-form').val(BipClient.getCollection('channel').searchBy).attr('tabindex', 0);
      },

      // renders result rows and pagination
      renderRows: function(selectedChannel) {
        var listContainer,
        listChannel,
        listPaginate,
        self = this,
        el = $(this.el, this._container);

        if (this._enableWidgetWrapper) {
          listContainer = $('#list-channel-container', el); // list container

          // render list
          listChannel = $('#channel-list', listContainer);
        } else {
          listChannel = el;
        }

        listChannel.empty();
        var channelJSON,
        channels;

        channels = this.collection.getFilteredModels();

        /*
                if (!this.filter) {
                    channels = this.collection.models;
                } else {
                    channels = this.collection.filter(function(channel) {
                        debugger;
                        return self.filter.match.test(channel.get(self.filter.attr));
                    });
                }
                */
        var start = (this.collection.page - 1) * this.collection.page_size,
        end = start + this.collection.page_size;

        channels.slice(start, end).forEach( function (item) {
          channelJSON = item.toJSON();
          //channelJSON.icon = item.getIcon();
          actionTokens = channelJSON.action.split('.');
          channelJSON.pod = actionTokens[0];
          if (selectedChannel) {
            channelJSON.podContext = true;
          } else {
            channelJSON.podContext = false;
          }
          listChannel.append( self.tplListEntity(channelJSON));
        });

        if (this.clickHandler) {
          $('.channel-list-item a').click(this.clickHandler);
        }

        $('.channel-list-item').removeClass('defocused')

        if (selectedChannel) {
          $('.channel-list-item a:not([data-channel-id=' + selectedChannel.get('id') + '])').addClass('defocused')
        }

        var clHeader = $('.channel-list h2');

        clHeader.html(this._filterContext
          ? ('<img class="hub-icon hub-icon-32" src="' + this._filterContext.getIcon() + '"/> ' + this._filterContext.get('title'))
          : ('All Saved Presets')
        );

        // update pagination controls in list (parent) container
        listPaginate = $('.channel-list-pagination', this._container);
        listPaginate.html(self.tplPaginate(self.collection.pageInfo()));

        $('a.prev', this._container).on('click', this.previous);
        $('a.next', this._container).on('click', this.next);

        this._setTabIndices();

        this.trigger('view:rendered');

      },

      _setTabIndices : function() {
        var idx = 1;
        $('.channel-list-item a').each(function() {
          $(this).attr('tabindex', idx);
          idx++;
        });
      },

      updateFilter : function(filter, selectedChannel) {
        this.collection.updateFilter(filter);
        //this.filter = filter;
        this.renderRows(selectedChannel);
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
      }
    });

    return ChannelListView;
  });
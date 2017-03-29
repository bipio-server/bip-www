define([
  'underscore',
  'backbone',
  'models/m_channel',
  'bipclient'
  ], function(_, Backbone, ChannelModel, BipClient){
    // Channel Collection
    ChannelCollection = Backbone.Collection.extend({
      model: ChannelModel,

      // pagination
      page : 1,
      page_size : 10,
      total : 0,
      num_pages : 1,
      sortBy : 'recent',
      searchBy : '',

      _filter : null,
      _actionManifest : {},

      _searchType : 'any',
      _exclusions : null, // exclude id's from search results

      // always get all channels
      url: function() {
        return BipClient.getResourceName(
          'channel',
          1,
          0,
          this.sortBy
          );
      },
      initialize : function() {
        _.bindAll(this,
          'nextPage',
          'prevPage',
          'pageInfo',
          'sort',
          'search',
          'newModel',
          'getEmitters',
          'getActions',
          'setSearchExclusions'
          );
      },

      getEmitters : function() {
        return this.where({
          _emitter : true
        });
      },

      getActions : function() {
        return this.where({
          _emitter : false
        });
      },

      getRenderable : function(toJSON) {
        var result = [], filtered, c;
        filtered = _.filter(this.models, function(m) {
          return Object.keys(m.get('_links')).length > 0;
        });

        if (toJSON) {
          _.each(filtered, function(channel) {
            c = channel.toJSON();
            c.pod = channel.getPod().toJSON();
            result.push(c);
          });
          return result;
        } else {
          return filtered;
        }
      },

      getChannelJSONAction : function(action) {
        return this._actionManifest[action];
      },

      getPods : function() {
        return _.uniq(_.map(this.pluck('action'), function(action) {
          var tokens = action.split('.');
          return tokens[0];

        }));
      },

      newModel : function(init, dedup) {
        if (dedup && init.name) {
          var idx = 0,
            highest = 0,
            numReg = new RegExp(/\d*$/);

          if (this.findWhere({ name : init.name }) ) {
            var channels = [];
            _.each(this.models, function(chan) {
              if (-1 !== chan.get('name').indexOf(init.name.trim() ) ) {
                result = chan.get('name').match(numReg).pop();
                if (result) {
                  idx = parseInt(result);
                  if (!isNaN(idx) && idx > highest) {
                    highest = idx;
                  }
                }
              }
            });
          }
        }

        if (highest) {
          init.name += ' - ' + (highest + 1);
        }

        return new this.model(init);
      },
      // pages are virtual
      parse: function(response) {
        this.page = response.page;
        this.page_size = this.page_size;
        this.total = response.total;
        this.num_pages = Math.ceil(response.total / this.page_size);
        for (var i = 0; i < response.data.length; i++) {
          this._actionManifest[response.data[i].action] = response.data[i].id;
        }

        return response.data;
      },

      setSearchType : function(searchType) {
        this._searchType = searchType || 'any';
      },

      setSearchExclusions : function(exclusions) {
        this._exclusions = exclusions;
      },

      getFilteredModels : function(searchBy) {
        var channels,
          self = this,
          activeSearch = this.searchBy;

        if (searchBy) {
          tmpSearch = true;
          this.searchBy = searchBy;
        } else {
          searchBy = this.searchBy;
        }

        if (!this._filter && this.searchBy === '') {
          if (this._searchType === 'actions') {
            channels = this.where({
              _emitter : false
            });

          } else if (this._searchType === 'emitters') {
            channels = this.where({
              _emitter : true
            });

          } else {
            channels = this.models;
          }
        } else {
          channels = this.models.filter(function(channel) {
            var match = false,
              searchStr,
              isEmitter = channel.get('_emitter'),
              matchRegexp = self.normSearchRegexp(searchBy);

            if ( (self._searchType === 'actions' && isEmitter) ||
              (self._searchType === 'emitters' && !isEmitter)) {
              return false;
            }

            if (self._filter) {
              match = self._filter.match.test(channel.get(self._filter.attr));
              if (!match) {
                return false;
              }
            }

            if (searchBy !== '') {
              searchStr = channel.get('_repr')
              + channel.get('action')
              + channel.get('name')
              + JSON.stringify(channel.get('config')).replace(/\W/g, '');

                match = matchRegexp.test(searchStr);
            }

            return match;
          });
        }

        if (this._exclusions) {
          channels = _.filter(channels, function(channel) {
            return _.indexOf(self._exclusions, channel.id) === -1;
          });
        }

        this.total = channels.length;
        this.num_pages = Math.ceil(this.total / this.page_size);

        // restore search
        this.searchBy = activeSearch;

        return channels;
      },

      updateFilter : function(filter) {
        this.page = 1;
        this._filter = filter;
        return this;
      },

      resetSearch : function() {
        this.searchBy = '';
        return this;
      },

      resetPage : function() {
        this.page = 1;
      },

      nextPage : function() {
        var next = this.page + 1;
        this.page = (next > this.num_pages) ? this.page : next;
      },

      prevPage : function() {
        var prev = this.page - 1;
        this.page = (prev <= 1) ? 1 : prev;
      },

      pageInfo : function() {
        return {
          page_current : this.page,
          page_total : this.num_pages,
          page_size : this.page_size,
          page_displayed_total : (this.page * this.page_size) - this.total,
          result_total : this.total
        }
      },

      sort : function(sort) {
        this.sortBy = sort;
        return this.fetch();
      },

      search : function(search) {
        if (!this.searchBy || '' === this.searchBy && search && this.page != 1) {
          this.page = 1;
        }
        this.searchBy = search;
      },

      normSearchRegexp : function(searchBy) {
        var normedSearch = searchBy
          ? searchBy
              .trim()
              .replace(/\s*/i, ' ')
              .replace(/\s/i, '.*')
              .replace(/,/g, '|')
              .replace(/,\s*/g, ',')
              .replace(/^\||\|$/, '')
          : '';

        return new RegExp(normedSearch, 'i')
      },

      get : function(id) {
        if (!id) {
          return;

        // if it's a UUID, then fall through to collection fetch
        } else if (BipClient.isUUID(id)) {
          return Backbone.Collection.prototype.get.call(this, arguments[0]);

          // backbone passed us an object
        } else if (id.id) {
          return id;

        // or cast a pseudo-channel
        } else {
          var tokens = id.split('.'),
            pod = BipClient.find.pod(tokens[0]),
            action = pod ? pod.getAction(tokens[1]) : undefined;

          if (pod && action) {
            return new ChannelModel({
              id : id,
              action : tokens[0] + '.' + tokens[1],
              name : action.title,
              description : action.description,
              _links : []
            });
          } else {
            return
          }
        }
      }

    });
    return ChannelCollection;
  });

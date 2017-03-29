define([
  'underscore',
  'backbone',
  'models/m_bip',
  'bipclient'
  ], function(_, Backbone, BipModel, BipClient) {
    var BipCollection = Backbone.Collection.extend({
      model: BipModel,

      // pagination
      page : 1,
      page_size : 10,
      total : 0,
      num_pages : 1,
      sortBy : 'recent',
      searchBy : '',

      // init
      initialize : function(noGlobal) {
        _.bindAll(this,
          'parse',
          'url',
          'nextPage',
          'prevPage',
          'pageInfo',
          'sort',
          'search',
          'factory',
          'factoryDefault'
          );

        if (!noGlobal) {
          BipClient.setCollection('bip', this);
        }
      },

      url: function() {
        var filter;
        if ($.isPlainObject(this.searchBy)) {
          filter = this.searchBy;
        } else if ('' !== this.searchBy) {
          filter = {
            name : this.searchBy
          }
        }
        return BipClient.getResourceName(
          'bip',
          1, //this.page,
          0, //this.page_size,
          this.sortBy
          //filter
          );
      },

      factory : function(data) {
        return new this.model(data);
      },

      factoryDefault : function(data) {
        if (!data) {
          data = {};
        }

        data.domain_id = userSettings.bip_domain_id;
        data.end_life = _.clone(userSettings.bip_end_life);
        data.end_life.action = userSettings.bip_expire_behaviour;
        data.hub = {
          source : {
            edges : []
//            transforms : {}
          }
        };

        if(!data.config) {
        	data.config = {
        	}
        }

        if ('http' === data.type) {
          data.config.auth = "token";
        }

        return this.factory(data);
      },

      factoryClone : function(id) {
        var model = BipClient.getCollection('bip').get(id),
          modelJSON = model ? JSON.parse(JSON.stringify(model.toJSON())) : {};

        return this.factory(modelJSON);
      },

      parse: function(response) {
        this.page = response.page;
        this.page_size = this.page_size;
        this.total = response.total;
        this.num_pages = response.num_pages;
        for (var i = 0; i < response.data.length; i++) {
          response.data[i].note = _.unescape(response.data[i].note);
        }

        return response.data;
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

      sort : function(sort, next) {
        this.sortBy = sort;
        return this.fetch({
          success : next
        });
      },

      search : function(search, next) {
        if (!this.searchBy || '' === this.searchBy && search && this.page != 1) {
          this.page = 1;
        }
        this.searchBy = search;
      },

      getFilteredModels : function() {
        var bips,
          self = this,
          // deep search into bound channels also
          matchedCids = self.searchBy ?
            _.pluck(BipClient.getCollection('channel').getFilteredModels(self.searchBy), 'id') :
            [];

        bips = this.models.filter(function(bip) {
          var match = false,
          searchStr, cids;

          if (self._filter) {
            match = self._filter.match.test(bip.get(self._filter.attr));
            if (!match) {
              return false;
            }
          // skip managed endpoint
          } else if (bip.get('app_id')) {
            //return false;
          }

          if (self.searchBy !== '') {
            searchStr = bip.get('_repr')
            + bip.get('note')
            + bip.get('name');

            match = (new RegExp(self.searchBy, 'gi')).test(searchStr);

            if (!match) {
              cids = bip.getChannelIds();
              if (_.intersection(cids, matchedCids).length ) {
                match = true;
              }
            }

          } else {
            match = true;
          }

          return match;
        });

        this.total = bips.length;
        this.num_pages = Math.ceil(this.total / this.page_size);

        return bips;
      }
    });

    return BipCollection;
  });

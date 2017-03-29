define([
  'underscore',
  'backbone',
  'bipclient',
  'models/m_pod',
  ], function(_, Backbone, BipClient, PodModel) {
    var ActionSearchableCollection = Backbone.Collection.extend({
      model: PodModel,

         // pagination
         page : 1,
         page_size : 10,
         total : 0,
         num_pages : 1,
         searchBy : '',
         _filter : null,

         _searchType : '',
         _exclusions : null, // exclude id's from search results

         podFilters : [],

         initialize : function() {
           _.bindAll(this,
             'updateFilter',
             'resetSearch',
             'nextPage',
             'prevPage',
             'pageInfo',
             'setSearchType',
             'search',
             'setSearchExclusions');

           this.podsCollection = BipClient.getCollection('pod');
           this.podsCollection.sort();
         },

         setSearchExclusions : function(excludedCids) {
          this._exclusions = excludedCids;
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
         return new RegExp(normedSearch, 'i');
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
         result_total : this.total
       }
     },

     setSearchType : function(searchType) {
      this._searchType = searchType || 'all';
    },

    search : function(search) {
      if (!this.searchBy || '' === this.searchBy && search && this.page != 1) {
       this.page = 1;
     }

     var filters = _.map(search.split(','), function(val) {
       return val.trim();
     });

     this.podFilters = [];

     for (var i = 0; i < filters.length; i++) {
       if (filters[i]) {
        this.podFilters.push(filters[i]);
      }
    }

    this.searchBy = search.trim();
  },

  getFilteredModels: function(search, podFilters) {

    var orderedPodActions = [];
    var self = this,
      searchType = this._searchType,
      podFilters = podFilters || self.podFilters;

    if (this.searchBy) {
      this.podsCollection.models.filter(function(pod) {
        // @todo allow level locked pods to appear in list
        // and add an upgrade path
        return !pod.get('level_locked');
      }).forEach( function (pod) {
         var match = search ? false : true,
         matchStr,
         typeMatch = false,
         filter;


        if (search) {
          matchStr = pod.get('name') + ' ' + pod.get('title') + ' ' + pod.get('tags');
          if (pod.get('tags')) {
           _.each(pod.get('tags'), function(tag) {
            if ('all' === searchType) {
              typeMatch = true;
            }
            matchStr += ' ' + tag;
           });
         };
         _.each(pod.get('actions'), function(action, key) {
           matchStr += ' ' + key + ' ' + action.title;
         });

          if (podFilters.length) {
            // rudimentary search, no weighted matches
            for (var i = 0; i < podFilters.length; i++) {
              if (podFilters[i]) {
                filter = new RegExp(podFilters[i], 'gi');
                match = filter.test(matchStr);
                if (match) {
                 break;
                }
              }
            }
          }
        }

        if ( match || !podFilters.length) {
          actions = pod.get('actions');
          _.each(Object.keys(actions).sort(), function(actionName) {
            action = actions[actionName];
            if ('all' === searchType
              || ('actions' === searchType && 'invoke' === action.trigger)
              || ('emitters' === searchType && 'invoke' !== action.trigger) ) {

              var channelModel = {
                name : pod.get('name'),
                title : action.title,
                action : pod.get('name') + '.' + actionName,
                config : {}
              };
              orderedPodActions.push(channelModel)
            }
          });
          }
        });

        // set page info
        this.num_pages = Math.ceil(orderedPodActions.length / this.page_size);
        this.total = orderedPodActions.length;
        this.reset(orderedPodActions);

        return this.models;
      } else {
        this.num_pages = 0;
        this.total = 0;

        return [];
      }
    }
  });

  return ActionSearchableCollection;

});
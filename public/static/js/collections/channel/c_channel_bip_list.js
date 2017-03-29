define([
    'underscore',
    'backbone',
    'models/m_bip',
    'bipclient'
    ], function(_, Backbone, BipModel, BipClient) {
        var ChannelBipList = Backbone.Collection.extend({
            model: BipModel,

            // pagination
            page : 1,
            page_size : 50,
            total : 0,
            num_pages : 1,
            sortBy : 'recent',
            searchBy : '',
            channelId : null,
            
            // init
            initialize : function(channelId) {
                _.bindAll(this,
                    'parse',
                    'nextPage',
                    'prevPage',
                    'pageInfo',
                    'sort',
                    'search'
                    );

                BipClient.setCollection('bip_log', this);
                this.channelId = channelId;
            },

            url: function() {
                return BipClient.getResourceName(
                                                'channel/' + this.channelId + '/bips',
                                                this.page,
                                                this.page_size,
                                                this.sortBy
                                            );
            },

            parse: function(response) {
                this.page = response.page;
                this.page_size = response.page_size;
                this.total = response.total;
                this.num_pages = response.num_pages;                
                return response.data;
            },

            nextPage : function() {
                var next = this.page + 1;
                this.page = (next > this.num_pages) ? this.page : next;
                return this.fetch();
            },

            prevPage : function() {
                var prev = this.page - 1;
                this.page = (prev <= 1) ? 1 : prev;
                return this.fetch();
            },

            pageInfo : function() {
                return {
                    page_current : this.page,
                    page_total : this.num_pages,
                    page_size : this.page_size,
                    result_total : this.total
                }
            },

            sort : function(sort) {
                this.sortBy = sort;
                return this.fetch();
            },

            search : function(search) {
                this.searchBy = search;
                return this.fetch();
            }
        });

        return ChannelBipList;
    });

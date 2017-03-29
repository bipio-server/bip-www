define([
    'underscore',
    'backbone',
    'models/m_domain',
    'bipclient'
    ], function(_, Backbone, DomainModel, BipClient){
        DomainCollection = Backbone.Collection.extend({
            model: DomainModel,
            url: function() {
                return BipClient.getResourceName('domain');
            },
            initialize : function() {
                BipClient.setCollection('domain', this);
                _.bindAll(this, 'newModel');
            },
            parse: function(response) {
                this.page = response.page;
                this.page_size = response.page_size;
                this.total = response.total;
                this.num_pages = response.num_pages;
                return response.data;
            },
            // factory
            newModel : function() {
                return new DomainModel();
            }
        });
        return DomainCollection;        
    });

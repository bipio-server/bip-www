define([
    'underscore',
    'backbone',
    'collections/domain/c_domain_all'
    ], function(_, Backbone, DomainCollection){        
        // Individual Domain
        var DomainView = Backbone.View.extend({
            tagName: "option",
            el : $('#domain_id'),

            initialize: function(){
                _.bindAll(this, 'render');
                this.collection = new DomainCollection();
            },
            render: function(){
                var id = this.model.get('id');
                $(this.el).attr('value', id).html(this.model.get('name'));
                if (userSettings.default_domain == id) {
                    $(this.el).attr('selected', 'selected');
                }
                return this;
            }
        });
        
        // Domain List (Select Box)
        var DomainsSelectView = Backbone.View.extend({
            initialize: function(){
                _.bindAll(this, 'addOne', 'addAll');
                this.collection.fetch({ success : this.renderRows });
            },
            addOne: function(domain){
                if (domain.get('_available') == true) {
                    $(this.el).append(new DomainView({
                        model: domain
                    }).render().el);
                }
            },
            renderRows: function(){
                this.collection.each(this.addOne);
            }
        });
        return DomainSelectView;
    });
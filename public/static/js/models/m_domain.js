define([
    'underscore',
    'backbone',
    'bipclient'
    ], function(_, Backbone, BipClient) {
        MDomain = Backbone.Model.extend({
            defaults: {
                'id' : null,
                'name' : '',
                '_available' : false
            },

            validate: function(attributes) {
            },
            initialize: function() {
                _.bindAll(this, 'rpcVerify');
            },
            url: function() {
                var self = this;
                return BipClient.getResourceURL('domain', self);
            },
            rpcVerify : function(cb) {
                var self = this;
                BipClient.domainVerify(this.id, function(err, domain) {
                    if (!err) {
                        self.set('_available', domain._available);
                    }
                    cb(err, self);
                });
            }
        });
        return MDomain;
    });



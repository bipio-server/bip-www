define([
    'underscore',
    'backbone',
    'bipclient'
    ], function(_, Backbone, BipClient) {
        MAccountOption = Backbone.Model.extend({
            defaults: {
                'id' : null,
                'avatar' : '',
                'timezone' : '',
                'bip_domain_id' : '',
                'bip_type' : '',
                'bip_config' : '',
                'bip_end_life' : '',
                'bip_hub' : '',
                'name' : ''
            },
            validate: function(attributes) {
            },
            initialize: function() {
            },
            url: function() {                
                return BipClient.getSettingsUrl();
            }
        });
        return MAccountOption;
    });



define([
    'underscore',
    'backbone',
    'bipclient'
    ], function(_, Backbone, BipClient) {
        MFeed = Backbone.Model.extend({
            defaults: {
                'id' : null,
                'title' : '',
                'description' : '',
                'summary' : '',
                'url' : '',
                'author' : '',
                'image' : '',
                'created_time' : '',
                'guid' : '',
                '_channel_id' : ''
            },

            initialize: function() {                
            }
        });
        
        return MFeed;
    });



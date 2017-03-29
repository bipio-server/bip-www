define([
    'underscore',
    'backbone'
    ], function(_, Backbone) {
        MMount = Backbone.Model.extend({
            defaults: {
                'id' : null,
                'label' : '',
                'url' : '',
                'username' : '',
                'token' : '',
                'locality' : 'local',
                'active' : false,
                'version':'',
                'apiminversion':''
            }            
        });
        return MMount;
    });



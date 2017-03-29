define([
    'underscore',
    'backbone'
    ], function(_, Backbone) {
        _.extend(Backbone.Model.prototype, Backbone.Validator);
        MChannelLog = Backbone.Model.extend({
        });
        
        return MChannelLog;
    });



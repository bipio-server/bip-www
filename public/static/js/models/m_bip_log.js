define([
    'underscore',
    'backbone'
    ], function(_, Backbone) {
        _.extend(Backbone.Model.prototype, Backbone.Validator);
        MBipLog = Backbone.Model.extend({
        });
        
        return MBipLog;
    });



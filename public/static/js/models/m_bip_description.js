define([
    'underscore',
    'backbone',
    'bipclient'
    ], function(_, Backbone, BipClient) {
        return Backbone.Model.extend({
            defaults: function() {                
                return {
                    'exports' : null
                }
            },
            validate: function() {
            },
            initialize: function() {

            },
            // get normalized exports for templating
            getExports: function(type) {                
                return this.exports[type].exports.properties;
            },
            
            getExportTemplate : function(type) {
            }
        });
    });



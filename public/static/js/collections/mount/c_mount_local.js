define([
    'underscore',
    'backbone',
    'models/m_mount',
    'bipclient',
    'sessionstorage'
    ], function(_, Backbone, MMount, BipClient) {
        MountLocalCollection = Backbone.Collection.extend({
            model: MMount,
            sessionStorage: new Backbone.SessionStorage("bipio-mounts"),
            initialize : function() {
                _.bindAll(this,
                    'activate'
                );
            },
            activate : function(id) {
                var model = this.get(id);
                model.set('active', !model.get('active'));

                _.each(this.models, function(model) {
                    if (model.id !== id) {
                        model.set('active', false);
                    }
                    model.save();
                });

                return model;
            }
        });
        return MountLocalCollection;
    });

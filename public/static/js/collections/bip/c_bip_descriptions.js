define([
    'underscore',
    'backbone',
    'models/m_bip_description',
    'bipclient'
    ], function(_, Backbone, BipDescModel, BipClient) {
        var BipDescCollection = Backbone.Collection.extend({
           model: BipDescModel,
            // pods are a little different, they're an abstract we can
            // describe with RPC's
            url: function() {
                return BipClient.getBipDescriptions();
            },
            initialize : function() {
                _.bindAll(this,
                    'getExports'
                    );

                BipClient.setCollection('bip_descriptions', this);
            },

            // compile descriptions into something useful for the front-end
            parse : function(response) {
                var k, struct, resp = [], generic = response['*'];

                for (k in response) {
                    if (k != '*') {
                        struct = {};

                        // shallow copy
                        for (var i in response[k]) {
                            struct[[i]] = response[k][i];
                        }


                        // definitions, properties
                        for (var g in generic) {
                            // def[key] property[key]
                            for (var i in generic[g]) {
                                struct[g][i] = generic[g][i];

                            }
                        }

                        resp.push({ id : k, exports : struct });
                    }
                }

                return resp;
            },
            getExports : function() {
                return this.get('exports');
            }
        });

        return BipDescCollection;
    });
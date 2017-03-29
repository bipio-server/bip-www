define([
    'underscore',
    'backbone',
    'bipclient',
    'hopscotch'
    ], function(_, Backbone, BipClient){

        var tour = {
            id : 'hello-bipio',
            steps : [
                {
                    title: "Select An Event",
                    content: "Get Started By Creating A New Event,<br/><br/> Or Choosing One From Your Saved Events Library",
                    target: '#link-channel-create',
                    placement : 'right',
                    arrowOffset : 'left'
                }
            ]
        }

        BipGetStartedView = Backbone.View.extend({
            initialize:function (container, bipId) {
                var self = this;
                _.bindAll(
                    this,
                    'render'
                );
            },

            render : function() {
                hopscotch.startTour(tour)
            },
        });

        return BipGetStartedView;
    });
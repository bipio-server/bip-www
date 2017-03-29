require.config({
    baseUrl : "/static/js",
    paths: {
        jquery: 'vendor/jquery/jquery-min',
        jquery_b64 : 'vendor/jquery/jquery.base64.min',
        //bootstrap : 'vendor/bootstrap/bootstrap',
        bootstrap : 'vendor/bootstrap/bootstrap-bundle',
        underscore: 'vendor/underscore/underscore-1.8.1',
        backbone: 'vendor/backbone/backbone-min',
        bipclient: 'client',
        c_domain : 'collections/domain/c_domain_all',
        c_channel : 'collections/channel/c_channel_all',
        c_channel_pod : 'collections/channel/c_pod_all',
        c_mount_local : 'collections/mount/c_mount_local',
        sessionstorage: "vendor/backbone/backbone.sessionStorage",
        'd3' : 'vendor/d3/d3.min'
    },
    shim : {
        "backbone": {
            deps: ["underscore", "jquery"],
            exports: "Backbone"  //attaches "Backbone" to the window object
        },
        'bootstrap': [ 'jquery' ],
        "d3" : {
            exports : "d3"
        },
        "jquery_b64" : {
            deps : [ "jquery" ]
        }
    }
});

define([
    'underscore',
    'backbone',
    'bipclient',
    'views/stats/v_stats',
    'bootstrap',
    'signin'
    ], function(_, Backbone, BipClient, StatsView) {

        var statsView = new StatsView();
        statsView.render();

        $.get(
            BIPClientParams.endpoint + '/status',
            function(response, status) {
                var str;
                if ('success' === status && response.version) {
                    str = 'v' + response.version;
                    $('#stat-title').append('<small class="pull-right">' + str + '</small>');
                }

            }
        );
}
);

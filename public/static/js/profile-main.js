require.config({
    baseUrl : "/static/js",
    paths: {
        underscore : "vendor/underscore/underscore-1.8.1",
        jquery: 'vendor/jquery/jquery-min',
        jquery_b64 : 'vendor/jquery/jquery.base64.min',
        bootstrap : 'vendor/bootstrap/bootstrap-bundle',
        'd3' : 'vendor/d3/d3.min',
        'share_svg': 'apps/community/views/v_share_svg',
        bipclient: 'client',
        underscore: 'vendor/underscore/underscore-1.8.1',
        backbone: 'vendor/backbone/backbone-min'
    },
    shim : {
        'bootstrap': [ 'jquery' ],
        "jquery_b64" : {
            deps : [ "jquery" ]
        }
    }
});

define([
    'underscore',
    'bootstrap',
    'signin',
    'share_svg',
    'views/stats/v_stats'
    ], function(_, Bootstrap, Signin, HubView, StatsView) {

    $('.profile-tabs a').click(function(e) {
        $(".profile-content > div").hide()
        $('.profile-tabs li').each(function(index, tab) {
            if ($(tab).hasClass('selected')) {
                $(tab).removeClass('selected')
            }
        })
        $(e.currentTarget).children().addClass('selected')
        $(e.currentTarget).show()
        $(".profile-"+$(e.currentTarget).data('tab')).show()
    })

    var statsView = new StatsView();
    statsView.render();
});
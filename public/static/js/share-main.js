require.config({
    baseUrl : "/static/js",
    paths: {
        underscore : "vendor/underscore/underscore-1.8.1",
        jquery: 'vendor/jquery/jquery-min',
        jquery_b64 : 'vendor/jquery/jquery.base64.min',
        bootstrap : 'vendor/bootstrap/bootstrap-bundle',
        'share_svg': 'apps/community/views/v_share_svg'
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
    'share_svg'
    ], function(_, Bootstrap, Signin, HubView) {

    var v = new HubView(_shareManifest, '#hub_svg');

    // normalize hub
    var manifest = JSON.parse(JSON.stringify(_shareManifest).replace(/\\u0001/g, '.') );

    v.render(manifest.hub);

    if (_authPrompt) {
        window.onload = function() {
          setTimeout(function() {
              $('.signin-spawn').trigger('click', { dest : '/dash#community/' + shareId } );
          }, 4000);
        };
    }
});
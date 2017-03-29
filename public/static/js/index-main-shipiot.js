require.config({
  baseUrl : "/static/js",

  paths: {
    'signup_inline' : 'signup/v_signup_inline',
    'sign_inline' : 'signin/v_sign_inline',
    jquery: 'vendor/jquery/jquery-min',
    jquery_b64 : 'vendor/jquery/jquery.base64.min',
    'bootstrap' : [ 'vendor/bootstrap/bootstrap-bundle' ],
    underscore: 'vendor/underscore/underscore-1.8.1',
    backbone : 'vendor/backbone/backbone-min',
    c_mount_local : 'collections/mount/c_mount_local',
    bipclient: 'client',
    sessionstorage: "vendor/backbone/backbone.sessionStorage",
    'share_svg': 'apps/community/views/v_share_svg'
  },
  shim : {
    'bootstrap': [ 'jquery' ],
    "jquery_b64" : {
      deps : [ "jquery" ]
    }
  }
});

require(['jquery', 'bootstrap', 'signin', 'share_svg' ], function($, Bootstrap, Signin, HubView) {

  var simpleEl = '#hub_svg_simple',
    cplEl = '#hub_svg_complex';

  var simpleManifest = {
    "type": "http",
    "name" : "DeviceSensorData",
    "note" : "Send sensor data over HTTP from your device to this bip, and route it to http://keen.io for storage and further analysis",
    "icon" : "",
    "hub": {
        "source": {
            "edges": [
                "keenio.add_event"
            ]
        }
    },
    "manifest" : [
        "keenio.add_event",
    ]
  };

  var v = new HubView(simpleManifest, simpleEl, { width: 350, height: 350});
  v.render(simpleManifest.hub);
  $(simpleEl).siblings('.share-description').html(simpleManifest.note);

  var complexManifest = {
    "name":"Thermostat Notifier - gated",
    "type": "trigger",
    "config": {
        "channel_id": "nest.read_temperature"
    },
    "hub": {
        "source": {
            "edges": [
                "math.eval",
                "http.request"
            ]
        },
        "math.eval": {
            "edges": [
                "flow.truthy"
            ]
        },
        "flow.truthy": {
            "edges": [
                "email.smtp_forward",
                "twitter.status_update"
            ]
        }
    },
    "note":"This integration monitors the temperature and logs it to another saved http url integration. But when the weather is nice, this one NOTIFIES us in an email AND sends out a tweet to tell everyone else as well!",
    "manifest" : [
        "nest.read_temperature",
        "math.eval",
        "http.request",
        "flow.truthy",
        "email.smtp_forward",
        "twitter.status_update",
    ]
  };

  var v = new HubView(complexManifest, cplEl, { width: 350, height: 350});
  v.render(complexManifest.hub);
  $(cplEl).siblings('.share-description').html(complexManifest.note);
});
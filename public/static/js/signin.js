// particles https://github.com/VincentGarreau/particles.js

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
  },
  shim : {
    'bootstrap': [ 'jquery' ],
    "jquery_b64" : {
      deps : [ "jquery" ]
    }
  }
});

require(
  ['jquery', 'bootstrap',  'bipclient', 'signup_inline', 'sign_inline' ],
  function($, Bootstrap, BipClient, SignupInlineView, SignInlineView) {
    var opts = {};

    if (BipClient.getReqParam('signup')) {
      opts.auto_spawn = true;

      var signupEmail = BipClient.getReqParam('signup_email');
      if (signupEmail) {
        opts.signup_email = signupEmail;
      }
    }

    var campaignId = BipClient.getReqParam('campaignId');
    if (campaignId) {
      opts.campaignId = campaignId;
    }

    // add inline signup
    var supInline = new SignupInlineView(opts);
    var sInline = new SignInlineView();
});
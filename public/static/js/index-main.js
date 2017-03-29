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
    particles : "views/v_particle",
    'share_svg': 'apps/community/views/v_share_svg'
  },
  shim : {
    'bootstrap': [ 'jquery' ],
    "jquery_b64" : {
      deps : [ "jquery" ]
    }
  }
});

require(['jquery', 'bootstrap', 'signin', 'particles', 'share_svg' ], function($, Bootstrap, Signin, ParticleView, HubView) {
  $('.carousel').carousel({
    interval : 15000
  });

  var windowHeight = $(window).height();

  $('#above-fold').height(windowHeight < 700 ? 700 : windowHeight);
	if($('#more-nav').length){
	  var moreNavST = $('#more-nav').offset().top - 80;

	  $('#more-nav').click(function(){
	    $('html, body').stop().animate({
	        scrollTop: $( $(this).attr('href') ).offset().top - 60
	    }, 400);
	    return false;
	  });
	}
  var shown = false;
  var p = new ParticleView('#above-fold');

  function signInToggle() {
    var yOffs = window.pageYOffset;
    if (yOffs < moreNavST && shown) {
      shown = false;
      $('.user').removeClass('in').addClass('out')

      if (p.paused) {
        p.play();
      }

    } else if (!shown && yOffs >= moreNavST) {
      shown = true;
      $('.user').removeClass('out').addClass('in');
      if (!p.paused) {
        delete p.pause();
      }
    }
  }

  $(window).on('scroll', function() {
    signInToggle();
  });

  signInToggle();
/*
  var podRows = $('#pod-list-doc .row'),
    rowHeight = $(podRows[0]).height()
    nRow = podRows.slice(4),
    nRowParent = nRow.parent();

  nRowParent.height(
    rowHeight * 4
  ).css('overflow', 'hidden').addClass('height-adjustable');

  $('#toggle-all-pods').on('click', function() {
    $(this).hide();
    $('#suggest-pod').show().addClass('in').removeClass('out')
    nRowParent.height(rowHeight * podRows.length);

    setTimeout(function() {
      nRowParent.css('overflow', 'visible');
    }, 1000);
  });
*/
  var simpleEl = '#hub_svg_simple',
    cplEl = '#hub_svg_complex';

  var simpleManifest = {
    "type" : "trigger",
    "name" : "gmail > dbox",
    "note" : "This bip detects new attachments in Gmail and saves them to Dropbox",
    "config" : {
        "channel_id" : "gmail.on_new_message"
    },
    "hub" : {
        "source" : {
            "edges" : [
                "dropbox.save_file"
            ]
        }
    },
    "manifest" : [
        "dropbox.save_file",
        "gmail.on_new_message"
    ]
  };

  var v = new HubView(simpleManifest, simpleEl, { width: 350, height: 350});
  v.render(simpleManifest.hub);
  $(simpleEl).siblings('.share-description').html(simpleManifest.note);

  var complexManifest = {
    "type" : "trigger",
    "name" : "New Follower - thanks & followback",
    "note" : "This bip detects when someone follows you on Twitter and follows them back with one of many custom greetings",
    "config" : {
        "channel_id" : "twitter.new_follower"
    },
    "hub" : {
        "source" : {
            "edges" : [
                "templater.text_template"
            ]
        },
        "templater.text_template" : {
            "edges" : [
                "math.random_int"
            ]
        },
        "math.random_int" : {
            "edges" : [
                "flow.lsplit"
            ]
        },
        "flow.lsplit" : {
            "edges" : [
                "math.eval"
            ]
        },
        "math.eval" : {
            "edges" : [
                "flow.truthy"
            ]
        },
        "flow.truthy" : {
            "edges" : [
                "twitter.status_update",
                "twitter.follow_user"
            ]
        }
    },
    "manifest" : [
        "flow.truthy",
        "twitter.status_update",
        "flow.lsplit",
        "math.eval",
        "math.random_int",
        "templater.text_template",
        "twitter.follow_user",
        "twitter.new_follower"
    ]
  };

  var v = new HubView(complexManifest, cplEl, { width: 350, height: 350});
  v.render(complexManifest.hub);
  $(cplEl).siblings('.share-description').html(complexManifest.note);
});
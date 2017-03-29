require.config({
  baseUrl : "/static/js",
  paths: {
    jquery: 'vendor/jquery/jquery-min',
    jquery_b64 : 'vendor/jquery/jquery.base64.min',
    bootstrap : 'vendor/bootstrap/bootstrap-bundle',
    underscore: 'vendor/underscore/underscore-1.8.1',
    backbone: 'vendor/backbone/backbone-min',
    sessionstorage: "vendor/backbone/backbone.sessionStorage",
    bipclient: 'client',
    c_domain : 'collections/domain/c_domain_all',
    c_channel : 'collections/channel/c_channel_all',
    c_channel_pod : 'collections/channel/c_pod_all',
    c_mount_local : 'collections/mount/c_mount_local',
    c_pod : 'collections/channel/c_pod_all',
    'd3' : 'vendor/d3/d3.min',
    'select2' : 'vendor/select2',
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
    },
    "select2" : {
      deps : [ "jquery" ]
    },
  }
});

require([
  'underscore',
  'backbone',
  'bipclient',
  'views/account_option/v_account_option',
  'views/domain/v_domain_admin',
  'views/stats/v_stats',
  'views/mount/v_mount',
  'models/m_account_option',
  'c_domain',
  'c_channel',
  'c_mount_local',
  'c_pod',
  'bootstrap',
  'select2'
  ], function(_, Backbone, BipClient, AccountOptionView, DomainAdminView,
  StatsView, MountsView, AccountOptionModel, DomainCollection, ChannelCollection,
  MountLocalCollection, PodCollection) {
    var c_domain = new DomainCollection();
    BipClient.setCollection('domain', c_domain);
    if(BIPClientParams["auth_type"] === "login_primary") {
	    var c_channel = new ChannelCollection();
	    BipClient.setCollection('channel', c_channel);
	    var c_pod = new PodCollection();
	    BipClient.setCollection('pod', c_pod);

	    var domainsView = new DomainAdminView({
	      collection : c_domain
	    });

	    var statsView = new StatsView();

	    var c_mounts_local = new MountLocalCollection();
	    var mountsView = new MountsView({
	      collection : c_mounts_local
	    });
    }


    var optionsView = new AccountOptionView({
      model : new AccountOptionModel(BipClient.getSettings())
    });

    var retries = 0, timer;

    function retry() {
      retries++;
      if (retries > 5) {
        window.location = '/timeout';
      } else {
        setTimeout(function() {
          init();
        }, 2000);
      }
    }

    function init() {
      BipClient.init().then(function() {

        if(BIPClientParams["auth_type"] !== "login_primary") {
    		  $.when(
          	c_domain.fetch({ reset : true })
          ).done(function() {
              $('#loader-wrapper').fadeOut(function() {
                $(this).remove();
              });
              optionsView.render();
            });
        }else {
          $.when(
            c_channel.fetch({ reset : true }),
            c_pod.fetch(
            {
              success : function() {
                BipClient.decorateChannels();
              }
            })
          ).done(function() {
            $.when(
              c_domain.fetch({ reset : true }),
              c_mounts_local.fetch({ reset : true }) )
            .done(function() {

              $('#loader-wrapper').fadeOut(function() {
                $(this).remove();
              });

              optionsView.render();
              statsView.render();
              domainsView.render();
            });
          });
         }
        },
        function() {
          retry();
        });

        $('#account-delete-confirm').on('click', function() {
          $(this).button('loading');
          $.ajax({
            url : '/plans/removeuser',
            success : function() {
              $(this).button('reset');
              window.location = '/';
            },
            error : function() {
              $(this).button('reset');
              BipClient.growl('An Error Occurred Cancelling Your Account', 'error');
              console.log(arguments);
            }
          });

        return false;
      });
    }

    init();
  });
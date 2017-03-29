require.config({
  baseUrl : "/static/js",
  paths: {
    jquery: 'vendor/jquery/jquery-min',
    jquery_b64 : 'vendor/jquery/jquery.base64.min',
    bootstrap : 'vendor/bootstrap/bootstrap-bundle',
    moment : 'vendor/moment.min',
    momenttz : 'vendor/moment-timezone.min',
    underscore: 'vendor/underscore/underscore-1.8.1',
    backbone: 'vendor/backbone/backbone-min',
    sessionstorage: "vendor/backbone/backbone.sessionStorage",
    'backbone.validator' : 'vendor/backbone/backbone-validation-amd-min',
    'd3' : 'vendor/d3/d3.min',
    'select2' : 'vendor/select2',
    'templar2':'vendor/templar2',
    bipclient: 'client',

    redactor : 'vendor/redactor/redactor',

    fuelux : 'vendor/fuelux',

    // master (context) collections
    c_domain : 'collections/domain/c_domain_all',
    c_channel : 'collections/channel/c_channel_all',
    c_channel_bip_list : 'collections/channel/c_channel_bip_list',
    c_mount_local : 'collections/mount/c_mount_local',
    c_bip : 'collections/bip/c_bip_all',
    c_bip_desc : 'collections/bip/c_bip_descriptions',
    c_bip_share : 'collections/bip/c_bip_share',
    c_bip_log : 'collections/bip/c_bip_log',
    c_channel_log : 'collections/channel/c_channel_log',
    c_pod : 'collections/channel/c_pod_all',
    wotadmin_hub : 'vendor/wotadmin-hub'
  },
  shim : {
    "backbone": {
      deps: ["underscore", "jquery"],
      exports: "Backbone"  //attaches "Backbone" to the window object
    },
    "templar2": {
        deps: ["jquery"]
    },
    'bootstrap': [ 'jquery' ],
    'backbone.validator' : {
      deps : [ 'backbone' ]
    },
    "d3" : {
      exports : "d3"
    },
    'bipclient' : {
      exports : 'BipClient'
    },
    "jquery_b64" : {
      deps : [ "jquery" ]
    },

    "moment" : {
      deps : [ "jquery" ]
    },
    "momenttz" : {
      deps : [ "jquery", "moment" ]
    },

    "redactor" : {
      deps : [ "jquery" ]
    },
    "select2" : {
      deps : [ "jquery" ]
    },
    "wotadmin_hub" : {
      exports: [ "WotAdmin_Hub" ]
    }
  }
});

require([
  'underscore',
  'backbone',
  'dash',
  'bipclient',
  'c_domain',
  'c_channel',
  'c_pod',
  'c_bip',
  'c_bip_desc',
  'c_bip_share',
  'c_mount_local',
  'backbone.validator',
  'bootstrap',
  'moment',
  'momenttz',
  'redactor',
  'select2',
  'fuelux/scheduler'
  ], function(_, Backbone, Dash, BipClient, DomainCollection,
    ChannelCollection, PodCollection, BipCollection, BipDescCollection,
    BipShareCollection, MountLocalCollection){

    _.extend(Backbone.Model.prototype, Backbone.Validation.mixin);

    var c_domain = new DomainCollection();
    BipClient.setCollection('domain', c_domain);

    var c_channel = new ChannelCollection();
    BipClient.setCollection('channel', c_channel);

    var c_bip = new BipCollection();
    BipClient.setCollection('bip', c_bip);

    var c_bip_desc = new BipDescCollection();
    BipClient.setCollection('bip_descriptions', c_bip_desc);

    var c_bip_share = new BipShareCollection();
    BipClient.setCollection('bip_shares', c_bip_share);

    var c_pod = new PodCollection();
    BipClient.setCollection('pod', c_pod);

    var c_mounts = new MountLocalCollection();

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

    function bootstrap() {
      // prefetch channel and domain lists
      $.when(
        c_channel.fetch(
        {
          success : function() {
            BipClient.decorateChannels();
          }
        }
        ),
        c_domain.fetch(),
        c_bip.fetch(),
        c_bip_desc.fetch(),
        c_pod.fetch(
        {
          success : function() {
            BipClient.decorateChannels();
          }
        }
        )
      ).done(
        function() {
          Dash.initialize();
        }
      );

      // only need channels to bootstrap
      // so load everything else here.
//      c_bip.fetch({ reset : true });
//      c_bip_desc.fetch({ reset : true });
      c_bip_share.fetch( { reset : true });
    }

    function init() {
      BipClient.init().then(function() {
        c_mounts.fetch({
          success : function(collection, models) {
            var model = collection.where({
              active : true
            }).shift();

            if (model) {
              BipClient.setCredentials(
                model.get('username'),
                model.get('token'),
                model.get('url')
                );
            }
            bootstrap();
          }
        });
      },
      function() {
        retry();
      });
    }

    init();
  });
define([
  'underscore',
  'backbone',
  'bipclient',
  'signup_inline',
  'bootstrap'
  ], function(_, Backbone, BipClient, SignupInlineView, Bootstrap) {

    var delay = (function(){
      var timer = 0;
      return function(callback, ms){
        clearTimeout (timer);
        timer = setTimeout(callback, ms);
      };
    })();

    var SignInlineView = Backbone.View.extend({

      tplSignupModal : _.template($('#tpl-modal-signin').html()),

      minUnLen : 5,

      signinDest : '/dash',

      initialize: function(){
        var self = this;

        _.bindAll(this, 'render');

        this.el = '.signin-modal-container';

        $('.signin-spawn').on('click', function(ev, opts) {
          if (opts && opts.dest) {
            self.signinDest = opts.dest;
          }
          self.render.apply(self, arguments);
        });

        $('.signin-spawn').css('visibility', 'visible')
      },

      render: function(ev, opts) {
        var self = this,
          $mc = $('#modal-container');

        $mc.html(this.tplSignupModal());

        $mc.modal().on('hide', function() {
          $mc.removeClass('md-show');
        });

        BipClient.centerModal($('#modal-container .modal'))

        $mc.addClass('md-show');

        this.$el = $(this.el);

        var $submit = $('#sign-in-submit');

        $submit.on('click', function() {

          $submit.button('loading');

          BipClient.signIn(
            $('#login_username').val(),
            $('#login_password').val(),
            function(err) {
              if (err) {
                $submit.button('reset');
                $submit.removeClass('btn-success').addClass('btn-danger').html('Please Retry');
                $("#login_username").focus();
              } else {
                window.location.replace(self.signinDest);
              }
            }
          );
        });

        $('#login_password').keyup(function (e) {
          e.preventDefault();
          if (e.which == 13) {
            $('#sign-in-submit').trigger('click');
          }
        });

        $('#login_username').keyup(function (e) {
          e.preventDefault();
          if (e.which == 13) {
            $('#sign-in-submit').trigger('click');
          }
        });

        setTimeout(function() { $('#login_username').focus() }, 500);

        $('#sign-in-btn').click(function(ev) {
          var x = setTimeout(function() {
            $("#login_username").focus()
          }, 100);
        });

        $('.signup-spawn', $mc).click(function() {
          $('#modal-container').modal('hide');
        });

        opts = opts || {};
        opts.parent = $mc;

        var supInline = new SignupInlineView(opts);

        return false;
      }
    });

    if ($('#tos-accept').length) {
      $('#tos-accept').click(function() {
        $.post("/terms-of-service", { tos_accept: true }, function() {
//          window.location = self.signinDest;
          window.location = '/dash';
        });
      });
    }

    return SignInlineView;
  });
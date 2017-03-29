define([
  'underscore',
  'backbone',
  'bipclient',
  ], function(_, Backbone, BipClient) {

    var delay = (function(){
      var timer = 0;
      return function(callback, ms){
        clearTimeout (timer);
        timer = setTimeout(callback, ms);
      };
    })();

    var SignupInlineView = Backbone.View.extend({

      tplSignupModal : _.template($('#tpl-modal-signup').html()),

      minUnLen : 5,

      signinDest : '/dash',

      opts : null,

      initialize: function(opts){
        var self = this;

        this.spawnParams = null;

        _.bindAll(this, 'render', 'signup', 'validate', 'vUsername', 'vPassword', '_notify');

        this.el = '.signup-modal-container';

        parentEl = opts.parent || $('body');

        $('.signup-spawn', parentEl).click(function(ev, params) {
          self.render.apply(self, arguments);
        });

        $('.signup-spawn', parentEl).css('visibility', 'visible')

        if (opts && opts.dest) {
          this.signinDest = opts.dest;
        }

        this.opts = opts;

        if (opts.auto_spawn) {
          $('.signup-spawn', parentEl).trigger('click');
        }

        if (opts.campaignId) {
          $('#campaignId').val(opts.campaignId);
        }

      },

      _notify : function(err, el) {
        var $help = $(el).parent().siblings('.message');
        if (err) {
          $help.removeClass('success').addClass('error');
        } else {
          $help.removeClass('error').addClass('success');
        }

        $help.html(err ? err : 'OK!');

        $help.removeClass('out').addClass('in');
      },

      vUsername: function() {
        var self = this,
          srcVal = this.$username.val(),
          vh = $('#vanity-helper'),
          $helpBlock = vh.parent();

        if (srcVal.length >= this.minUnLen) {
          $.ajax({
            url : "/signup/check?un=" + srcVal,
            type: "GET",
            dataType: 'json',
            success : function(data) {
              self._notify(false, self.$username);

              $helpBlock.removeClass('error');
              $helpBlock.addClass('success');

              vh.html(srcVal + '.' + BIPClientParams.hostname);
            },
            error : function(xhr, status, err) {
              self._notify(err, self.$username);

              $helpBlock.removeClass('success');
              $helpBlock.addClass('error');

              vh.html('Username');

//              vh.html('{not available}' + '.' + BIPClientParams.hostname);
              self._notify('Not Available', self.$username);

            }
          });
        } else {
          // @todo add error
          self._notify('Too Short, ' + this.minUnLen + ' Char Minimum', this.$username);

          $helpBlock.addClass('error');
          $helpBlock.removeClass('success');

          vh.html('Username');

        }
      },
      vPassword: function() {
        var srcVal = this.$password.val();
        if (!srcVal.trim()) {
          this._notify('Required', this.$password);
        } else {
          this._notify(null, this.$password);
        }
      },

      vEmail: function() {
        var srcVal = this.$email.val();
        if (!srcVal.trim()) {
          this._notify('Required', this.$email);
        } else {
            var re = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
        	if(re.test(srcVal)){
        		this._notify(null, this.$email);
        	}else{
        		this._notify('Invalid Email Address', this.$email);
        	}
        }
      },


      validate: function(src) {
        if (src === this.$username[0]) {
          this.vUsername();
        } else if (src === this.$password[0]) {
          this.vPassword();
        } else if (src === this.$email[0]) {
          this.vEmail();
        }
      },

      signup : function($el, upgrade) {
        var current = $el.html(),
          self = this,
          loading = $el.attr('data-loading-text'),
          formData = $('#signup_form').serialize();

        $el.html(loading);

        $.ajax({
          url : '/signup',
          type : 'POST',
          data : formData,
          success : function() {
            BipClient.signIn(
              $('#signup_username').val(),
              $('#signup_password').val(),
              function(err) {
                if (err) {
                  $el.html(current);
                  $('#error-signup').removeClass('out').addClass('in');
                  $('#btn_signup').removeAttr('disabled');
                } else {
                  // logged in, so upgrade account
                  if (upgrade) {
                    window.location = '/plans?plan=' + upgrade;

                    //$('#modal-container').modal();

                    /*
                    $(window).trigger(
                      'plan_upgrade',
                      {
                        plan : upgrade,
                        email : formData.signup_email
                      }
                    );
*/
                  } else {
                    setTimeout(function() {
                      $('#btn_signup').removeAttr('disabled');
                      window.location.replace(self.signinDest);
                    }, 2000);
                  }
                }
              }
            );
          },
          error: function() {
            $el.html(current);
            $('#error-signup').removeClass('out').addClass('in');
          }
        });
      },

      render: function(ev, options) {
        var self = this,
          upgrade = options && options.upgrade ? options.upgrade : null;

        $('#modal-container').html(this.tplSignupModal());

        $('#modal-container').modal().on('hide', function() {
          $('#modal-container').removeClass('md-show');
        });

        BipClient.centerModal($('#modal-container .modal'))

        $('#modal-container').addClass('md-show');

        /*.on('click', function() {
          $(this).modal('hide')
        });*/

        this.$el = $(this.el);

        this.$username = $('#signup_username', this.$el);

        this.$password = $('#signup_password', this.$el);

        this.$email = $('#signup_email', this.$el);
        this.$email.val(this.opts.signup_email);

        this.$username.on('keyup', function() {
          var el = this,
            start = this.selectionStart,
            end = this.selectionEnd,
            val = $(this).val();

          el.setSelectionRange(start, end);

          $(this).val(
            val.toLowerCase().replace('_', '-').replace(/[^a-z0-9-]/g, '')
          );

          el.setSelectionRange(start, end);

          delay(function() {
            self.validate(el);
            }, 400);
          }
        ).on('blur', function() {
//          self.validate(this);
        }).focus();

        this.$password.on('blur', function() {
//          self.validate(this);
        });

        this.$email.on('blur', function() {
//          self.validate(this);
        });

        $('#tos-accept').on('click', function() {
          if ($(this).is(':checked')) {
            $('#btn_signup').removeAttr('disabled');
          } else {
            $('#btn_signup').attr('disabled', 'disabled');
          }
        });

        $('#btn_signup').on('click', function() {
          //debugger;
          $('#btn_signup').attr('disabled', 'disabled');
          self.validate(self.$username[0]);
          self.validate(self.$password[0]);
          self.validate(self.$email[0]);

          if (!$('.error', self.$el).length) {
            self.signup($(this), upgrade);
          }else{
              $('#btn_signup').removeAttr('disabled');
          }
        });

        return false;
      }
    });

    return SignupInlineView;
  });
define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/bipio/views/v_curl',
  ], function(_, Backbone, BipClient, CurlView){

    AuthView = Backbone.View.extend({
      tplAuth :  _.template( $('#tpl-bipio-auth').html() ),
      events: {},
      $username : null,
      $password : null,
      $type : null,
      initialize:function (tabContainer, contentContainer, model) {
        var self = this;

        this.model = model;

        _.bindAll(
          this,
          'render',
          'toggleAuth',
          'setUsername',
          'setPassword',
          'setAuthHeaderHint'
          );

        var containerId = 'bip-auth-panel';

        $(tabContainer).append(
          '<li><a data-toggle="pill" href="#' + containerId + '"> Auth</a></li>'
        );

        $(contentContainer).append(
          '<div class="tab-pane span12" id="' + containerId + '"></div>'
        );

        this.el = '#' + containerId;
        this.$el = $(this.el);
      },

      render : function() {
        var config = this.model.get('config');
        // set tab content
        this.$el.html(
          this.tplAuth(this.model.toJSON())
        );

        this._curlView = new CurlView(this.model);
        this._curlView.render();

        this.$type = $('#auth', this.$el);
        this.$username = $('#auth_username', this.$el);
        this.$password = $('#auth_password', this.$el);

        this.$type.on('change', this.toggleAuth);
        this.$username .on('keyup', this.setUsername);
        this.$password.on('keyup', this.setPassword);

        this.setAuthHeaderHint();

        this.$type.val(config.auth);
      },

      setAuthHeaderHint : function() {

        var authHeader = this.model.getAuthHeader();

        this._curlView.render();

        $('.auth-headers', this.$el).text(authHeader || 'No Authorization Header Required');
      },

      setUsername : function(ev) {
        this.model.get('config').username = $(ev.currentTarget).val();
        this.setAuthHeaderHint();
      },

      setPassword : function(ev) {
        this.model.get('config').password = $(ev.currentTarget).val();
        this.setAuthHeaderHint();
      },

      toggleAuth : function(ev) {
        var src = $(ev.currentTarget),
          authHeader = '',
          selected = src.find(':selected').val();
          ev.preventDefault();

        if ('basic' === selected) {
          $('#auth-control').css('display', 'block');
        } else {
          $('#auth-control').css('display', 'none');
        }

        this.model.get('config').auth = selected;
        this.setAuthHeaderHint();
      },
    });

    return AuthView;
  }
);
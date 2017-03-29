require.config({
  baseUrl : "/static/js",
  paths: {
    jquery: 'vendor/jquery/jquery-min',
    bootstrap : 'vendor/bootstrap/bootstrap-bundle'
  },
  shim : {
    'bootstrap': [ 'jquery' ]
  }
});

define([ 'jquery', 'bootstrap', 'signin' ], function($) {
  $('#btn_reset').on('click', function(ev) {
    var email = $('#email_address').val(),
      nonce = $('#_nonce').val(),
      $err = $('#error-reset');

    if (email && nonce) {
      $.ajax({
        type : 'POST',
        url :'/reset',
        data : {
          email : email,
          _nonce : nonce
        },
        success : function() {
          $err.removeClass('alert-error').addClass('alert-success');
          $err.html('<i class="icon-ok-sign"></i> Instructions Sent!');
          $err.show();
        },
        error : function(xhr) {
          $err.removeClass('alert-success').addClass('alert-error');
          if(xhr.status=="409"){
        	  $err.html('Sorry, That User Could Not Be Found');
          }else{
        	  $err.html('An Unknown Error Occurred');
          }
          $err.show();
        }
      });
    }

  });

  $('#btn_confirm').on('click', function(ev) {
    var email = $('#email_address').val(),
      nonce = $('#_nonce').val(),
      token = $('#token').val(),
      password = $('#new_password').val(),
      password_c = $('#new_password_c').val(),
      $err = $('#error-reset');

    if (password && password !== password_c) {
      $err.removeClass('alert-success').addClass('alert-error');
      $err.html('Passwords Do Not Match');
      $err.show();
    } else {
      if (email && nonce) {
        $.ajax({
          type : 'POST',
          url :'/reset',
          data : {
            email : email,
            _nonce : nonce,
            password : password,
            token : token
          },
          success : function() {
            $err.removeClass('alert-error').addClass('alert-success');
            $err.html('<i class="icon-ok-sign"></i> Password Reset!');
            $err.show();
            setTimeout(function() {
              window.location = '/';
            }, 2000);

          },
          error : function() {
            $err.removeClass('alert-success').addClass('alert-error');
            $err.html('An Error Occurred');
            $err.show();
          }
        });
      }
    }

  });

});

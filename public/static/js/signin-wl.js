require.config({
  baseUrl : "/static/js",
  paths: {
    'jquery': [ 'vendor/jquery/jquery-min' ],
    'bootstrap' : [ 'vendor/bootstrap/bootstrap-bundle' ],

  },
  shim : {
    'bootstrap': [ 'jquery' ]
  }
});

require( [ 'jquery', 'bootstrap' ], function($) {
  var $submit = $('#sign-in-submit');

  $submit.click(function() {
    $submit.button('loading');

    var reqStruct = {
      type: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      data: JSON.stringify({
        'username' : $('#login_username').val(),
        'password' : $('#login_password').val()
      }),
      url: '/auth',
      success: function(resData, status, xhr) {
        //window.location.replace('/dash');
        window.location.replace('/dash');
      },
      error: function(xhr, status, errText) {
        $submit.button('reset');
        $submit.removeClass('btn-success').addClass('btn-danger').html('Please Retry');
        $("#login_username").focus();
      }
    };

    $.ajax(reqStruct);
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

  $('#login_username').focus();

  $('#sign-in-btn').click(function(ev) {
    var x = setTimeout(function() {
      $("#login_username").focus()
    }, 100);
  });
});
require.config({
    baseUrl : "/static/js",
    paths: {
        jquery: 'vendor/jquery/jquery-min',

        //bootstrap : 'vendor/bootstrap/bootstrap',
        bootstrap : 'vendor/bootstrap/bootstrap-bundle',
        underscore: 'vendor/underscore/underscore-1.8.1',
        backbone: 'vendor/backbone/backbone-min',
        bipclient: 'client',
        c_domain : 'collections/domain/c_domain_all',
        c_channel : 'collections/channel/c_channel_all',
        c_channel_pod : 'collections/channel/c_pod_all',
        c_mount_local : 'collections/mount/c_mount_local',
        sessionstorage: "vendor/backbone/backbone.sessionStorage"
    },
    shim : {
        "backbone": {
            deps: ["underscore", "jquery"],
            exports: "Backbone"  //attaches "Backbone" to the window object
        },
        'bootstrap': [ 'jquery' ],

        "jquery_b64" : {
            deps : [ "jquery" ]
        }
    }
});

define([
    'underscore',
    'backbone',
    'bipclient',
    'bootstrap',
    'signin'
    ], function(_, Backbone, BipClient) {

function isElementVisible(selector) {
    var
      el = $(selector)[0],
      rect     = el.getBoundingClientRect(),
      vWidth   = window.innerWidth || doc.documentElement.clientWidth,
      vHeight  = window.innerHeight || doc.documentElement.clientHeight,
      efp      = function (x, y) { return document.elementFromPoint(x, y) };

    // Return false if it's not in the viewport
    if (rect.right < 0 || rect.bottom < 0
            || rect.left > vWidth || rect.top > vHeight)
        return false;

    // Return true if any of its four corners are visible
    return (
          el.contains(efp(rect.left,  rect.top))
      ||  el.contains(efp(rect.right, rect.top))
      ||  el.contains(efp(rect.right, rect.bottom))
      ||  el.contains(efp(rect.left,  rect.bottom))
    );
}

      var $scrollHint = $('.scroll-down');

      if (!isElementVisible('#plan-accept')) {
        $scrollHint.show();
        $(window).scroll(function() {
          if ($scrollHint) {
            $scrollHint.remove();
          } else {
            $scrollHint = null;
          }
        });

        $scrollHint.on('click', function() {
          $('html,body').animate(
            {
              scrollTop : $(this).offset().top
            }
          );
        });
      } else {
        $scrollHint.remove();
      }

      // stripe requires inline external JS which blocks
      // the DOM and breaks selectors, so wait until
      // everything is completely loading before trying to
      // bind events
      $(document).ready(function() {

        var $purcahseBtns = $('.btn-purchase'),
            $activePaymentForm,
            tosAccept = false,
            $tosBox = $('#accept-tos'),
            $tosButton = $('#btn-tos-ok'),
            $tosClose = $('#plan-accept-tos-modal .close,#plan-accept-tos-modal .modal-close'),
            $tosModal = $('#plan-accept-tos-modal');

        $tosBox.prop('checked', false);
        $tosButton.attr('disabled', !tosAccept);

        $tosBox.on('click', function() {
          if ($(this).is(':checked')) {
              tosAccept = true;
          } else {
              tosAccept = false;
          }

          $tosButton.attr('disabled', !tosAccept);
        });

        // set tos accept parameters
        $tosButton.on('click', function() {

          if (userSettings) {
            $('.stripe-button-el').click();
          } else {
            // signup
            $('.signup-spawn').trigger('click',
              {
                upgrade : $('input[name=plan]').val()
              }
            );
          }

          /*
          var form = $(this).parent('form').serializeArray();

          if (form['accept-tos']) {
              tosAccept = form['accept-tos'];
          }
          $tosModal.modal('hide');
          */
        });

        // on modal close, spawn stripe form and reset modal
        $tosModal.on('hidden', function() {
          if (tosAccept) {
              $activePaymentForm.click();
          }
          tosAccept = false;
          $tosButton.attr('disabled', !tosAccept);
        });

        $tosClose.on('click', function() {
          tosAccept = false;
          $tosButton.attr('disabled', !tosAccept);
        });

        // logged in and upgrading
        if (userSettings) {
          $purcahseBtns.on('click', function() {
              $activePaymentForm = $('.stripe-button-el', $(this).parent().siblings('form'));

              $tosBox.prop('checked', false);

              $('#plan-title').html(
                  $('h2', $(this).parents('.pricing-table')).text()
              );

              $pt = $('#plan-table');
              $pt.empty();

              _.each($('.price-row', $(this).parents('.pricing-table')), function(el) {
                  $pt.append('<div class="price-row">' + $(el).text() + '</div>');

              });

              $('#plan-accept-tos-modal').modal('show');

              BipClient.centerModal($('#plan-accept-tos-modal .modal'));
            })
        } else {
            // attach signups
            $purcahseBtns.on('click', function() {
              $('.signup-spawn').trigger('click',
                {
                  upgrade : $('input[name=plan]', $(this).parent().siblings('form')).val()
                }
              );
              return false;
            })
        }

        $('a.scrollTo').on('click', function() {
            $('html, body').stop().animate({
              scrollTop: $( $(this).attr('href') ).offset().top - 60
            }, 400);
            return false;
        });

        var err = BipClient.getReqParam('error');

        if (err) {
          BipClient.growl(err + ' : Please email support@bip.io for assistance upgrading', 'error');
        }

        var plan = BipClient.getReqParam('plan');
        if (plan) {
          $('#table-' + plan + ' .btn-purchase').click();
        }
      });

      if (_redirPodLinks) {
        $('.pod-select a').on('click', function() {
          window.open($(this).attr('href'));
          return false;
        });
      }
    }
);

require.config({
    baseUrl : "/static/js",
    paths: {
        underscore : "vendor/underscore/underscore-1.8.1",
        jquery: 'vendor/jquery/jquery-min',
        jquery_b64 : 'vendor/jquery/jquery.base64.min',
        bootstrap : 'vendor/bootstrap/bootstrap-bundle'
    },
    shim : {
        'bootstrap': [ 'jquery' ],
        "jquery_b64" : {
            deps : [ "jquery" ]
        }
    }
});

define([
    'underscore',
    'bootstrap',
    'signin'
    ], function(_, Bootstrap, Signin) {

    if ($('#tpl-community-list').length) {
        var tpl = _.template($('#tpl-community-list').html() );

        var $carousel = $('#integration-renderto .carousel-inner');

        var bipEls = $('#shares-master .bip-select'),
            $bipEl, $a, $button,
            $panel, $lSection, $rSection, $lList, $rList,
            page = 0,
            newTarget,
            pageSize = 4,
            pages = Math.ceil(bipEls.length / pageSize),
            authed = userSettings && userSettings.username;

        function addPanel() {
            var $panel = $('<div class="item"></div>');
            $carousel.append($panel);
            return $panel;
        }

        for (var i = 0; i < bipEls.length; i ++) {
            $bipEl = $(bipEls[i]);

            if (!authed) {
                $a = $('a', $bipEl);
                //newTarget = '/share/' + encodeURIComponent($a.attr('href') );
                $a.attr('href', newTarget );

                $button = $('button', $bipEl);
                //$button.attr('data-target', newTarget);
            }

            if (0 === i % pageSize) {
                $panel = addPanel();

                $lSection = $(tpl());
                $rSection = $(tpl());

                $lList = $('.list-widget ', $lSection);
                $rList = $('.list-widget ', $rSection);

                $panel.append($lSection).append($rSection);
            }

            if (0 === i % 2) {
                $lList.append($bipEl);
            } else {
                $rList.append($bipEl);
            }
        }

        $('.item:first').addClass('active');

        $('#integration-renderto').removeClass('hide');

        $('button', bipEls).on('click', function() {
            window.location.href = $(this).attr('data-target');
        });

        var $carousel = $('.carousel');

        $carousel.carousel({
            interval : false
        });

        if (bipEls.length > 4) {
            $('#share-paginate').show();
            $('a.prev,a.next').on('click', function() {
                $carousel.carousel($(this).attr('class').trim());
                return false;
            });
        }
    }
});
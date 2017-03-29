define([
    'underscore',
    'backbone',
    'bipclient',
    'apps/pods/views/v_channel_select'
    ], function(_, Backbone, BipClient, ChannelSelectView){

        AccountOptionView = Backbone.View.extend({
            el: $('#account_options'),
            events: {
                "click #option-submit" : "publish"
            },
            initialize:function () {
                _.bindAll(
                    this,
                    'render',
                    'publish',
                    'errTranslate'
                    );
            },

            render: function() {
                var el = $(this.el);
                var tpl = _.template($('#tpl-resource-account-options').html());

                var dict = this.model.toJSON();
                dict.domainCollection = BipClient.getCollection('domain').toJSON();

                dict.expiry_imp = parseInt(dict.bip_end_life.imp);
                if (dict.expiry_imp == 0) {
                    dict.expiry_imp = '';
                }

                dict.expiry_time_period = '';

                if (dict.bip_end_life.time != 0 && dict.bip_end_life.time != '') {
                    // if its an account default calculation
                    if (dict.bip_end_life.time.match) {
                        var timeTokens = dict.bip_end_life.time.match(/(\d+)(h|d|m|y)/);
                        // ghetto
                        if (timeTokens[1] && timeTokens[2]) {
                            dict.expiry_time = timeTokens[1];
                            dict.expiry_time_period = timeTokens[2];
                        } else {
                        // else what?
                        }
                    // otherwise it has been translated to a date
                    } else {
                        dict.explicitDate = true;
                        var expireDate = new Date(dict.bip_end_life.time * 1000);
                        dict.expiry_time = expireDate.toString('dd-MM-yyyy');
                    }
                } else {
                    dict.expiry_time = '';
                }
                dict.avatar = '';
                el.html(tpl(dict));

                // regenerate token
                $('#key-regen').popover();
                $('#key-regen').click(function() {
                    // set password if present
                    $.ajax({
                        url : '/auth/regen?_nonce=' + $('#_nonce').val(),
                        success : function(result, res, xhr) {
                            BipClient.growl('API Token Regenerated');
                            $('#token_token').html(result.api_token);
                        }
                    });
                });

                $('#dash_token').tooltip({
                    placement: 'top'
                });

                // UI
                $('.token_style').on('click', BipClient.selectContents);

                $('#timezone').select2();

                return this;
            },

            // translates from a model attribute to form, and renders an error
            errTranslate: function(isErr, attribute, error) {
                var el = $('#opt_' + attribute, self.el).closest('.control-group');
                if (el.length === 0) {
                    el = $('#' + attribute, self.el).closest('.control-group');
                }
                if (isErr) {
                    el.addClass('error');
                    el.find('.help-block').html(error);
                } else {
                    el.removeClass('error');
                    el.find('.help-block').html('');
                }
            },

            _refreshUser : function() {
                $.ajax({
                    url : '/auth/refresh',
                    success : function(result, res, xhr) {
                        userSettings = result;
                        // update src for images with user-avatar class
                        // to be the returned avatar.
                        intvl = setInterval(function() {
                            var el = $('.user-avatar');
                            var d = new Date();
                            $('#avatar').attr('value', '');
                            $('.user-avatar').attr('src', userSettings.avatar + '?' + d.getTime() );
                            clearInterval(intvl);
                        }, 4000);
                    }
                });
            },

            publish: function(e) {
                var avatar,
                    timezone,
                    cid = $.trim($('#channel_id_selected').val()),
                    pw = $('#opt_password').val(),
                    pwc = $('#opt_password_c').val(),
                    name = $('#name-actual').val(),
                    self = this;

                e.preventDefault();

                //
                if (pw != pwc) {
                    this.errTranslate(true, 'password', "Passwords don't match");
                    this.errTranslate(true, 'password_c', "Passwords don't match");
                    return;
                } else {
                    this.errTranslate(false, 'password');
                    this.errTranslate(false, 'password_c');
                }

                if (!name || '' === name) {
                    this.errTranslate(true, 'name-actual',"Can't be nameless");
                    return;
                }

                var end_life = {
                    'imp' : $.trim($('#bip_expiry_imp').val()),
                    'time' : ""
                }

                var expiryDate = $('#bip_expiry_date').val();
                if (expiryDate) {
                    var modelEndLife = this.model.get('end_life');

                    // if date changed...
                    var modelExpireDate = new Date(modelEndLife.time * 1000);
                    if (expiryDate != modelExpireDate.toString('dd-MM-yyyy')) {
                        end_life.time = expiryDate;
                    }  else {
                        end_life.time = modelEndLife.time;
                    }
                } else {
                    // assemble save str
                    var expiryTime = $.trim($('#bip_expiry_time').val());
                    if (expiryTime != '' && expiryTime != 0) {
                        end_life.time = '+' + expiryTime + $.trim($('#bip_expiry_time_resolution').find(':selected').val())
                    }
                }

                var optionStruct = {
                    avatar : $('#avatar').val(),
                    timezone : $('#timezone').val(),
                    // @todo end_life
                    bip_end_life : end_life,
                    bip_domain_id : $.trim($('#bip_domain_id :selected').val()),
                    bip_expire_behaviour : $('#bip_expire_behaviour :button.active').attr('data-selection'),
                    bip_type : $('#bip_type :button.active').attr('data-selection')
                }

                this.model.set(optionStruct);

                if (this.model.isValid(true)) {
                    this.model.save(
                        this.model.toJSON(),
                        {
                            silent  : false,
                            sync    : false,
                            success : function(model, res, xhr) {
                                var refresh = true;
                                // set name if present
                                if (name !== userSettings.name) {
                                    refresh = false;
                                    $.ajax({
                                        url : '/auth/setname?name=' + name + '&_nonce=' + $('#_nonce').val(),
                                        success : function() {
                                          self._refreshUser();
                                        },
                                        error : function() {
                                            BipClient.growl('Failed to update Name', 'error');
                                        }
                                    });
                                }

                                // set password if present
                                if (pw) {
                                    refresh = false;
                                    $.ajax({
                                        url : '/auth/newpw?new_pw=' + pw + '&_nonce=' + $('#_nonce').val(),
                                        success : function(result, res, xhr) {
                                            BipClient.growl('Password and Options Saved');
                                            self._refreshUser();
                                            $('#password').val('');
                                        }
                                    });

                                } else {
                                    BipClient.growl('Options Saved');
                                }

                                if (refresh) {
                                    self._refreshUser();
                                }
                            },
                            error: function(model, res) {
                                BipClient.growl('An Error Occurred', 'danger');
                            }
                        });
                }
            }
        });

        return AccountOptionView;

    });
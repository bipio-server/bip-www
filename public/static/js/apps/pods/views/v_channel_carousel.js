/*
 * Channel selection carousel view
 */
define([
    'underscore',
    'backbone',
    'bipclient',
    ], function(_, Backbone, BipClient ){

        var ChannelCarouselView = Backbone.View.extend({
            el: '', // render widget to this container
            tplWidget: _.template( $('#tpl-channel-slider').html() ), // widget container
            _preambleTxt : '',
            _containerId : 'channelCarousel',  // isolates bip vs hub channel carousels
            _channels : {}, // normalized channels
            _selectedChannel : null,
            _hasDependents : false,

            // @param mode string 'actions' or 'emitters'
            // @param element string render into this element selector
            initialize: function(containerId, mode, element, preambleTxt, channels, selected, hasDependents) {
                _.bindAll(
                    this,
                    'getSelectedChannel'
                );

                this.el = element;                

                if (!channels) {
                    var c = BipClient.getCollection('channel');
                    //var actions = BipClient.getCollection(mode),
                    var actions = (mode === 'actions') ? c.getActions() : c.getEmitters() ,
                        pods = BipClient.getCollection('pod');

                    for (var idx in actions) {
                        model = actions[idx].toJSON();
                        tokens = model.action.split('.');
                        action = pods.get(tokens[0]).get('actions')[tokens[1]];

                        model._pod = {
                            name : tokens[0],
                            title : action.title,
                            description : action.description || '',
                            imports : action.imports.properties
                        };

                        this._channels[model.id] = model;
                    }
                } else {
                    this._channels = channels;
                }

                this._selectedChannel = selected;
                this._preambleTxt = preambleTxt;
                this._containerId = containerId;
                //this._hasDependents = (undefined !== hasDependents);

                this._hasDependents = (hasDependents && 
                    (!selected || Object.keys(this._channels).length > 1));
            },

            // renders the list container
            render: function(ignoreFilter) {
                var self = this,
                    tpl = {
                        containerId : this._containerId,
                        selected : this._selectedChannel,
                        channels : this._channels,                        
                        getChannel : function(id) {
                            return this.channels[id] || null;
                        },
                        numChannels : Object.keys(this._channels).length,
                        preamble : this._preambleTxt,
                        // suppresses channel selection slider
                        hasDependents : this._hasDependents
                    };

                $(this.el).html(this.tplWidget(tpl));

                //
                $('.carousel', $(this.el)).on('slid', function(ev) {
                   var src = $(ev.currentTarget).children().children('.active'),
                        cid = src.attr('data-selected');

                    self.selectChannel(cid);
                });
            },

            selectChannel : function(cid) {
                if (!cid) {
                    return;
                }

                this._selectedChannel = cid;

                var struct = {
                        channelId : cid,
                        defaultName : '',
                        defaultDescription : '',
                        //pod : src.attr('data-pod')
                        pod : this._channels[this._selectedChannel].action.split('.')[0]
                    };

                if (cid) {
                    struct.defaultName = this._channels[this._selectedChannel].name;
                    struct.defaultDescription = this._channels[this._selectedChannel].description;
                }

                this.trigger('channel-select', struct);
            },

            getSelectedChannel : function() {
                return this._selectedChannel;
            }
        });
        return ChannelCarouselView;
    });
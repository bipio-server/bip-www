/*
 * 
 * @todo migrate to Hub
 * 
 */
define([
    'underscore',
    'backbone',
    'bipclient'
    ], function(_, Backbone, BipClient){
        // Individual Channel (List)
        var ChanneViewLI = Backbone.View.extend({
            tagName: "li",

            initialize: function(){
                _.bindAll(this, 'render', 'renderRow');
            },
            renderRow: function(model) {
                var actionTokens = model.get('action').split('.');
                var rClass = actionTokens[0];
                var channelIcon = model.get('config')['icon_url'];
                var ciImg = '<img width="16px" src="/static/img/clear.gif"/>';
                if (undefined != channelIcon) {
                    ciImg = '<img width="16px" src="' + channelIcon + '"/>';
                }

                // @todo determine by action convention
                if (rClass == 'email') {
                    rClass = 'smtp';
                } else if (rClass == 'syndication') {
                    rClass = 'rss-local';
                }

                //return '<i class="channel-' + rClass + ' channel-micro channel-colored"></i>&nbsp;<i class="icon-arrow-right"></i>&nbsp;' + ciImg + '&nbsp;&nbsp;' + model.get('name');
                return ciImg + '&nbsp;<i class="channel-' + rClass + ' channel-micro channel-colored"></i>&nbsp;' + model.get('name');
                

            },
            render: function() {
                $(this.el).attr('data-value', this.model.get('id')).html(
                    '<a href="#">' + this.renderRow(this.model) + '</a>'
                    );
                return this;
            }
        });

        // Channel List (Select Box)
        var ChannelSelectView = Backbone.View.extend({
            el : $('#channel_id'),
            initialize: function(){
                _.bindAll(this, 'addOne', 'addAll', 'selectChannel');
                this.collection = BipClient.getCollection('channel');               
            },
            addOne: function(channel){
                var item = new ChanneViewLI({
                    model: channel
                }).render().el;
                
                
                $(this.el).append(item);
            },
            addAll: function(){
                this.collection.each(this.addOne);
                $('.dropdown-toggle').dropdown();   
            },
            render: function() {
                this.addAll();
                return this;
            },
            
            selectChannel : function(id) {
                if (id) {
                     $('#channel_id_title').html(
                        new ChanneViewLI().renderRow( BipClient.getCollection('channel').get(id) )
                        );

                    $('#channel_id_selected').attr('value', id);
                }
            },
            
            clickChannel : function(ev) {
                var src = $(ev.currentTarget);
                ev.preventDefault();
                this.selectChannel(src.attr('data-value'));
            },
            
            events : {
                'click li' : 'clickChannel'
            }                
        });

        return ChannelSelectView;
    });
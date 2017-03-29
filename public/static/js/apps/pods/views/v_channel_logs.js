define([
  'underscore',
  'backbone',
  'bipclient',
  'c_channel_log',
  'moment'
  ], function(_, Backbone, ChannelClient, ChannelLogCollection){
    ChannelLogsView = Backbone.View.extend({
      //el: '#channel-setup',

      events: {
        'click a.prev' : 'previous',
        'click a.next' : 'next'
      },
      initialize:function (container, channelId) {
        var self = this;
        _.bindAll(
          this,
          'render',
          'previous',
          'next'
          );
        this.el = container;
        this.collection = new ChannelLogCollection(channelId);
        this.collection.fetch({
          success : this.render
        });
      },

      render : function() {
        var models = this.collection.models,
        el = $(this.el),
        logDate;

        if (models.length) {
          for (var i = 0; i < models.length; i++) {
            logDate = moment(parseInt(models[i].get('created'))).format('MMMM Do YYYY, h:mm:ss a');
            el.append(
              '<tr>'
              + '<td class="alert alert-danger">' + $('<div/>').text(models[i].get('message').substring(0, 400)).html() + '</td>'
              + '<td nowrap style="text-align:right" class="row-extras">Date <strong>' + logDate + '</strong><br/>'
              + 'Transaction <strong>' + models[i].get('transaction_id') + '</strong> ' + '<br/>'
              + '<a class="pull-right" href="/dash#bipio/' + models[i].get('bip_id') + '">View Source Bip</a>'
              + '</td>'
              + '</tr>'
            );
          }
        } else {
          $('#channel-logs-panel').html(
            '<div class="alert alert-warning"><i class="icon-exclamation-sign"> No Logs Available</div>'
          );
        }
      },

      previous: function(ev) {
        ev.preventDefault();
        if ($(ev.currentTarget).hasClass('disabled')) {
          return;
        }
        this.collection.prevPage();
        return false;
      },

      next: function(ev) {
        ev.preventDefault();
        if ($(ev.currentTarget).hasClass('disabled')) {
          return;
        }
        this.collection.nextPage();
        return false;
      }

    });

    return ChannelLogsView;
  });
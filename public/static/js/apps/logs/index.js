/**
 *
 * logs app container
 *
 */
define([
  'underscore',
  'backbone',
  'bipclient'
  ], function(_, Backbone, BipClient) {

    var BipModuleView = Backbone.View.extend({
      el: '#logs-container', // render widget to this container
      appID : 'logs', // identify bips created with this app

      container : null,
      router : null,

      _limit : 1000,

      initialize : function() {
        var self = this;
        _.bindAll(
          this,
          'render'
        );
      },

      shutdown : function() {
      },

      // renders the app container
      render : function(mode, id) {
        var self = this,
          tplHTML = _.template($('#tpl-layouts-' + this.appID).html());

        this.container.html(tplHTML());

        $('.btn-group button', this.el).on('click', function() {
          self._renderLogs(
            $(this).attr('data-mode')
          );
        });

        this._fetchLogs(function() {
          self._renderLogs();
        });
      },

      _logs : null,

      _fetchLogs : function(next) {
        var statsURL = BipClient.getEndpoint() + '/rpc/logs/server',
          date = moment().format('YYYYMMDD'),
          self = this;

        statsURL += '/' + date + '/' + self._limit;

        BipClient.callRPCAccount(
          statsURL,
          function(result) {
            self._logs = result;
            if (next) {
              next();
            }
          }
        );
      },

      _renderLogs : function(newMode) {
        var self = this,
          mode = newMode || $('.btn-group .active', self.el).attr('data-mode'),
          $table = $('#result-table'),
          errMode = 'errors' === mode,
          usageFail = 'usage' === mode,
          uncaught = 'uncaught' === mode,
          $tbody = $('tbody', $table),
          $thead = $('thead', $table),
          $limitNote = $('#limit-note'),
          count = 0;

        $tbody.empty();
        $thead.empty();

        if ('raw' == mode) {
          $tbody.append(
            '<pre>' + JSON.stringify(self._logs, true, 4) + '</pre>'
          );

          $limitNote.html('Last ' + this._limit);

        } else if (errMode || usageFail || uncaught) {

          // distinct stacks
          var stacks = {};

          $thead.append(
            '<tr>'
            + '<td></td>'
            + '<td>Timestamp</td>'
            + '<td>Message</td>'
            + '<td>Stack</td>'
            + '</tr>'
          );

          //
          if (self._logs) {
            _.each(
              self._logs.server_error,
              function(log) {
                if (log.stack) {
                  if (
                    errMode
                    || (usageFail && log.message.split(':').length > 2 )
                    || (uncaught && log.message.indexOf('uncaughtException') !== -1 )
                    ) {

                    if (!stacks[log.stack]) {
                      stacks[log.stack] = {
                        log : log,
                        count : 0
                      };
                    }

                    stacks[log.stack].count++;
                  }
                }
              }
            );
          }

          var stacksArray = _.sortBy(
            _.map(
              stacks, function(value, key) {
                return { stack : key, log : value}
              }
            ),
            function(stack) {
              return stack.log.count;
            }
          ).reverse();

          if (stacksArray.length) {
            criticality = Math.round(stacksArray[0].log.count / 3);
          }

          _.each(
            stacksArray,
            function(stack) {
              var errClass = '',
                icon = 'minus-sign';

              if (stack.log.count > criticality * 2) {
                errClass = 'error';
                icon = 'exclamation-sign';
              } else if (stack.log.count > criticality ) {
                errClass = 'warning';
                icon = 'warning-sign';
              }

              var stackStr = stack.log.log.stack.join
                  ? stack.log.log.stack.join('</br>')
                  : stack.log.log.stack.replace(/(?:\r\n|\r|\n)/g, '<br />'),
                msgTokens = stack.log.log.message.split(':'),
                pod = msgTokens[0].split('.').shift(),
                msgStr = '',
                iconImg = '',
                maxLength = 50;

              _.each(msgTokens, function(line) {
                msgStr += (line.length > maxLength ? (line.substr(0, maxLength) + '..') : line) + '</br>';
              });

              if (pod && BipClient.find.pod(pod)) {
                iconImg = '<img src="' + BipClient.find.pod(pod).getIcon() + '">';
              }

              var em = '<em style="font-size:0.4em;position:absolute;margin-top: -10px;margin-left: 0px;">'
              + stack.log.count
              + '</em>';

              $tbody.append(
                '<tr class="' + errClass + '">'
                + '<td><h1><i class="icon-' + icon + '"></i>' + em + iconImg + '</h1></td>'
                + '<td>' + stack.log.log.timestamp+ '</td>'
                + '<td>' + msgStr + '</td>'
                + '<td>' + stackStr + '</td>'
                + '</tr>'
              );
              count += stack.log.count;
            }
          );

          $limitNote.html(
            count
            + ' results, '
            + ( (count / self._logs.server_error.length) * 100).toFixed(0)
            + '%'
            + ' (' + stacksArray.length + ' distinct)'
          );
        }
      },

      appInfo : function(router, container) {
        var self = this,
          info = {
            name : this.appID,
            title : 'Logs',
            ready : function(next) {
              // master route (router gobbles scope)
              router.route(self.appID, self.appID, function() {
                self.render.apply(self, arguments);
              });

              // ready!
              next();
            }
          };

        this.container = container;
        this.router = router;

        return info;
      }
    });

    return BipModuleView;
  });
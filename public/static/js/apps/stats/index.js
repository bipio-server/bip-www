/**
 *
 * stats app container
 *
 */
define([
  'underscore',
  'backbone',
  'bipclient'
  ], function(_, Backbone, BipClient) {

    var BipModuleView = Backbone.View.extend({
      el: '#stats-container', // render widget to this container
      appID : 'stats', // identify bips created with this app

      container : null,
      router : null,

      initialize : function() {
        var self = this;
        _.bindAll(
          this,
          'render'
        );
      },

      shutdown : function() {
      },

      getPreviousMonthParams : function() {
        var params = '',
          lastMonth = moment().subtract(1, 'months');

        params += 'fromUnix=' + lastMonth.startOf('month').unix();
        params += '&toUnix=' + lastMonth.endOf('month').unix();

        return params;
      },

      _renderTwitter : function() {
        $twitter = $('#metric-twitter', this.$el);

        var twitterURL = BipClient.getEndpoint() + '/rpc/channel/twitter.users_show/invoke?screen_name=bipioapp'

        BipClient.callRPCAccount(
          twitterURL,
          function(result) {
            $('.metric-value', $twitter).html(result.followers_count);
          }
        );
      },

      _renderGithub : function() {
        $github = $('#metric-github', this.$el);

        var ghURL = BipClient.getEndpoint() + '/rpc/channel/github.get_repository/invoke?owner=bipio-server&repo=bipio'

        BipClient.callRPCAccount(
          ghURL,
          function(result) {
            var content = result.watchers_count + ' Watchers,<br/>'
              + result.forks + ' Forks';

            $('.metric-value', $github).html(content);
          }
        );
      },

      _renderMailChimp : function() {
        $mc = $('#metric-mailchimp', this.$el);

        var mcURL = BipClient.getEndpoint() + '/rpc/channel/mailchimp.get_growth_history/invoke?list_id=b56498e932'

        BipClient.callRPCAccount(
          mcURL,
          function(results) {
            var content = '',
              stat,
              months = 2;

            for (var i = 0; i < months; i++) {
              stat = results.pop();
              content += stat.month + ' - ' + stat.existing + '<br/>';
            }

            $('.metric-value', $mc).html(content);
          }
        );
      },

/*
      _renderUsers : function() {
        $usersRecent = $('#metric-users tbody', this.$el);

        var statsURL = BipClient.getEndpoint() + '/rpc/stats/users'

        BipClient.callRPCAccount(
          statsURL,
          function(result) {
            var content = result.users;

            $('.metric-value', $usersRecent).html(content);
          }
        );
      },
*/
      _users : null,

      _tableToCSV : function(tableId) {
        var csv = "data:text/csv;charset=utf-8,",
          $tr = $('#' + tableId + ' tbody tr'),
          $th = $('#' + tableId + '  thead th'),
          $td;

          // headers
          var line = '';
          _.each($th, function(col) {

            if (line) {
              line += ',';
            }

            line += $(col).text();
        });

        csv += line + '\n';

        // rows
        _.each($tr, function(row) {
          var $row = $('td', row),
            line = '';

            _.each($row, function(col) {
              if (line) {
                line += ',';
              }

              line += $(col).text();
            });

            csv += line + '\n';
        });

        var encodedUri = encodeURI(csv);
        window.open(encodedUri, tableId + '.csv');
      },

      _renderUserRows : function() {

        var result = this._users,
          css,
          stat,
          status,
          ok,
          count = 0,
          monthFilter = false,
          planFilters = {},
          activityFilters = {},
          havePlanFilters = false,
          haveActivityFilters = false,
          summaryReport = {},
          month;

        // get filters

        var filters = $('#stat_filters input[type=checkbox]:checked');
        _.each(filters, function(el) {

          if (el.id == 'filter_month') {
            monthFilter = true;

          } else if (0 == el.id.indexOf('filter_level') ) {

            planFilters[el.id.split('_').pop()] = true;

          } else if (0 == el.id.indexOf('filter_activity') ) {
            activityFilters[el.id.split('_').pop()] = true;
          }
        });

        havePlanFilters = Object.keys(planFilters).length;

        haveActivityFilters = Object.keys(activityFilters).length;

        result.stat = _.sortBy(result.stat, function(obj) { return Number(obj.created_day) } ).reverse()

        $users.empty();

        for (var i = 0; i < result.stat.length; i++) {
          css = '';
          status = '';
          stat = result.stat[i];
          ok = true;

          if (monthFilter && parseInt(stat.created_day) < parseInt(moment().subtract(1, 'month').format('YYYYMMDD')) ) {
            ok = false;
          }

          if (havePlanFilters) {
            ok = ok && planFilters[stat.account.account_level];
          }

          if (stat.total && stat.account.last_session) {
            css = 'success';
            status = 'Active';
          }

          if (!stat.total && !stat.ttfb) {
            css = 'warning';
            status = 'Aborted';
          }

          if (!stat.total && !stat.ttfb && !stat.account.last_session || !css) {
            css = 'error';
            status = 'Zombie';
          }

          if (ok && haveActivityFilters) {
            ok = ok && activityFilters[status.toLowerCase()];
          }

          if ( ok ) {
            $users.append(
              '<tr class="' + css + '">'
              + '<td>' + stat.account.username + '</td>'
              + '<td>' + stat.account.email_account + '</td>'
              + '<td>' + stat.account.account_level + '</td>'
              + '<td>' + stat.total + '</td>'
              + '<td>' + stat.ttfb + '</td>'
              + '<td>' + moment(stat.created_day, "YYYYMMDD").format("Do MMM YYYY") + '</td>'
              + '<td>' + stat.account.last_session_pretty + '</td>'
              + '<td>' + status + '</td>'
              + '<td>' + stat.plan_params.reason.join('<br/>') + '</td>'
              + '</tr>'
            );

            count++;
          }

          // create summary
          month = moment(stat.created_day, "YYYYMMDD").format("MMM YYYY");
          if (!summaryReport[month]) {
            summaryReport[month] = {
              signups : 0,
              active : 0,
              bips : 0
            };
          }

          summaryReport[month].signups++;
          summaryReport[month].active += ('Active' === status ? 1 : 0)
          summaryReport[month].bips += stat.total;
        }

        var $summaryTable = $('#metric-users-summary tbody', this.$el),
          numUsers = result.stat.length;

        $summaryTable.empty();
        _.each(summaryReport, function(struct, month) {
          $summaryTable.append(
            '<tr>'
            + '<td>' + month + '</td>'
            + '<td>' + numUsers + '</td>'
            + '<td>' + struct.signups + '</td>'
            + '<td>' + struct.active + '</td>'
            + '<td>' + (((struct.active / struct.signups) * 100).toFixed(0) + '%') + '</td>'
            + '<td>' + struct.bips + '</td>'
            + '</tr>'
          );

          numUsers -= struct.signups;
        })


        $('#num_results').html(count + ' results, ' + ( (count / result.stat.length) * 100).toFixed(0) + '%');
      },

      _renderUsersRecent : function() {
        var self = this;

        $users = $('#metric-users-recent tbody', this.$el);

        $('#filter_month').attr('checked', true);

        $('#csv').on('click', function() {
          self._tableToCSV('metric-users-recent');
        });

        $('#csv_summary').on('click', function() {
          self._tableToCSV('metric-users-summary');
        });

        $('#csv_pods').on('click', function() {
          self._tableToCSV('metric-pods');
        });

        $('#csv_shares').on('click', function() {
          self._tableToCSV('metric-shares');
        });

        var statsURL = BipClient.getEndpoint()
          + '/rpc/stats/users/recent'
          + '?planparams=1'
//          + this.getPreviousMonthParams();

        BipClient.callRPCAccount(
          statsURL,
          function(result) {
            self._users = result.users;

            self._renderUserRows();

            $('#metric-users .metric-value').html(self._users.stat.length);

          }
        );

        $('#stat_filters input[type=checkbox]').on('click', function() {
          self._renderUserRows();
        });
      },

      _renderBips : function() {
        $bips = $('#metric-bips', this.$el);

        var statsURL = BipClient.getEndpoint() + '/rpc/stats/bips'

        BipClient.callRPCAccount(
          statsURL,
          function(result) {
            var content = result.bips;

            $('.metric-value', $bips).html(content);
          }
        );
      },

      // distinct # of bips running last month
      _renderDistinctPrevious : function() {
        $distinct = $('#metric-distinct-bips', this.$el);

        var statsURL = BipClient.getEndpoint()
          + '/rpc/stats/bips/distinct_running?'
          + this.getPreviousMonthParams();

        BipClient.callRPCAccount(
          statsURL,
          function(result) {
            var content = result.bips.distinct.length;

            $('.metric-value', $distinct).html(content);
          }
        );
      },

      _renderPods : function() {
        $pods = $('#metric-pods tbody', this.$el);

        var statsURL = BipClient.getEndpoint()
          + '/rpc/stats/pods/users';

        BipClient.callRPCAccount(
          statsURL,
          function(result) {
            var pods = result.pods,
              orderedPods = [],
              html;

            // get all pods
            BipClient.getCollection('pod').each(function(pod) {
              var statPod = pods[pod.get('name')];

              orderedPods.push({
                icon : pod.getIcon(),
                name : pod.get('name'),
                title : pod.get('title'),
                count : statPod && statPod.count ? statPod.count : 0,
                users : statPod && statPod.users ? statPod.users : []
              });

              html = '<tr><td>'
                + pod.getIcon()
                + '</td><td>'
                + pod.get('title')
                + '</td><td>'
                + '</td></tr>';
            });


            orderedPods = _.sortBy(orderedPods, function(pod) {
              return pod.count
            }).reverse();


            _.each(orderedPods, function(pod) {
              $pods.append(
                '<tr class="' + (!pod.count ? 'error' : '') + '""><td>'
                  + '<img src="' + pod.icon + '" class="hub-icon hub-icon-32"> '
                  + pod.title
                  + '</td><td>'
                  + pod.count
                  + '</td><td>'
                  + pod.users.join('<br/>')
                  + '</td><td>'
                  + (-1 !== BipClient._plans.user.pod_exclusions.indexOf(pod.name) ? 'Premium' : 'Community')
                  + '</td></tr>'
              );
            });

          }
        );
      },

      _renderShares : function() {
        var $shares = $('#metric-shares tbody', this.$el),
          icon,
          bipCollection = BipClient.getCollection('bip');

        // don't want to mess with the global collection, so just
        // grab all shares pre-sorted by # installs
        var shareURL = BipClient.getResourceName(
          'bip/share/list',
          1,
          0,
          'installs',
          undefined,
          'rpc'
        );

        BipClient.callRPCAccount(
          shareURL,
          function(shares) {

            $shares.empty();

            shares.data = _.sortBy(shares.data, function(share) {
              if (!share.installs) {
                share.installs = 0;
              }
              return share.installs
            }).reverse();

            _.each(shares.data, function(share) {
              icon = bipCollection.factory(
                share
              ).getIcon();

              $shares.append(
                '<tr>'
                + '<td><img class="hub-icon hub-icon-32" src="' + icon + '"> ' + share.name + '</td>'
                + '<td>' + share.installs + '</td>'
                + '<td><a target="_blank" href="/user/' + share.user_name + '">' + share.owner_name + '</a></td>'
                + '</tr>'
              );
            });
          }
        );
      },

      // renders the app container
      render : function(mode, id) {
        var self = this,
          tplHTML = _.template($('#tpl-layouts-' + this.appID).html());

        this.container.html(tplHTML());

//        this._renderUsers();
        this._renderUsersRecent();
        this._renderBips();
        this._renderPods();

        this._renderTwitter();
        this._renderGithub();
        this._renderMailChimp();
        this._renderShares();

//        this._renderDistinctPrevious();

      },

      appInfo : function(router, container) {
        var self = this,
          info = {
            name : this.appID,
            title : 'Stats',
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
define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/pods/views/v_channel_pod_list'
  ], function(_, Backbone, BipClient, PodListView){

    FunctionsListView = Backbone.View.extend({
      tplFunctions : _.template($('#tpl-bipio-function-selector').html()),

      $select2 : null,

      pods : [],

      _select2Opts : null,

      actionExlcusions : [
        'flow.generator'
      ],

      initialize : function (el) {
        var self = this;
        _.bindAll(
          this,
          'render',
          '_resultFormatter'
        );
        this.el = el;
        this.$el = $(el);

        this.podListView = new PodListView();
        // get pods
        this.pods = this.podListView.collection.filter(function(pod) {
          return (-1 !== BipClient._functionPods.indexOf(pod.id));
        });
      },

      _resultFormatter : function(el) {
        var tokens = el.id.split('.'),
          podIcon = BipClient.find.pod(tokens[0]).getIcon(tokens[1]);
        return '<img class="hub-icon hub-icon-16" src="' + podIcon + '"> ' + el.text;
      },

      openSelect : function() {
        this.$select.select2('open');
      },

      bindEvents : function() {
        var self = this,
          $dropdown,
          $caretSpan;

        this.$select.select2(this._select2Opts)
          .on('change', function(ev) {
            self.$select.select2('data', null);
            self.trigger('function:selected', ev.val);
          })
          .on('select2-open', function() {
            $caretSpan.attr('class', 'icon-chevron-up')
          })
          .on('select2-close', function() {
            $caretSpan.attr('class', 'icon-chevron-down')
            self.trigger('select2-close');
          });

        $dropdown = $('button.select2-arrow.dropdown-toggle', this.$el)
        $dropdown.attr('class', 'select2-arrow dropdown-toggle');

        $caretSpan = $('span.caret', $dropdown);
        $caretSpan.attr('class', 'icon-chevron-down');
      },

      render : function() {
        var self = this,
          val;

        this.$el.append(
          this.tplFunctions()
        );

        this.$select = $('#function-select2 select', this.$el);

        this.pods.forEach(function(pod) {
          var actions = pod.get('actions');
          _.each(actions, function(action, id) {
            val = pod.get('name') + '.' + id;
            if ( -1 === self.actionExlcusions.indexOf(val) ) {
              self.$select.append(
                '<option value="' + val + '">' + action.title + '</option>'
              );
            }
          });
        });

        this._select2Opts = {
          placeholder: "Add A Function",
          allowClear: true,
          containerCss : {
            width : '300px'
          },
          dropdownCssClass : 'function-select2-active',
          formatResult : this._resultFormatter,
          formatSelection : this._resultFormatter
        }

        this.bindEvents();
      }
    });

    return FunctionsListView;
  });
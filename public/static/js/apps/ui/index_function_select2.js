/**
 *
 * BipIO graphs app.
 *
 * UI app container - for developing and testing views
 *
 */
define([
  'underscore',
  'backbone',
  'bipclient',
  'apps/bipio/views/v_functions_list',
  ], function(_, Backbone, BipClient, FunctionsListView) {

    var BipModuleView = Backbone.View.extend({
      el: '#ui-container', // render widget to this container
      appID : 'ui', // identify bips created with this app

      container : null,
      router : null,

      obView : null,

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


        this.test();
      },

      // implement injected view specific tests here
      test : function() {

        var functionList = new FunctionsListView('#ui-container .row .span12');

        functionList.render();

        functionList.on('function:selected', function(func) {
          console.log(func);
        });
      },

      appInfo : function(router, container) {
        var self = this,
          info = {
            name : this.appID,
            title : 'UI',
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
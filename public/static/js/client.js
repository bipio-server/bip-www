/**
 *
 * Client frontend for the BIP REST API
 *
 * Requires jQuery
 *
 *
 */
define([
  'jquery',
  'jquery_b64',
  'backbone',
  'c_mount_local',
  ],
  function($, b64, Backbone, MountLocalCollection ) {

    function ClientEvent(type) {
      this._evListeners = [];
      this.type = type;
    }

    // basic event bridge
    ClientEvent.prototype = {
      on : function (fn) {
        this._evListeners.push(fn);
      },

      unbind : function (fn) {
        var index;
        index = this._evListeners.indexOf(fn);
        if (index > -1) {
          this._evListeners.splice(index, 1);
        }
      },

      trigger : function () {
        var listeners = this._evListeners,
        len = listeners.length,
        i;
        for (i = 0; i < len; ++i) {
          listeners[i].apply(null, arguments);
        }
      }
    }

    var ConfirmModalClass = Backbone.View.extend({
      el: "#confirm-modal",
      events: {
       "click #btn-nav-ok": "cb",
      },
      initialize: function(args) {
        //this.$el.off('click');
        this.cb = args.cb;
        _.bindAll(
          this,
          'cb',
          'close'
        );

        if (!args.title) {
          args.title = 'Warning';
        }

        $('h2', this.$el).html(args.title);

        if (!args.body) {
          args.body = 'Any Unsaved Changes Will Be Lost'
        }

        $('.modal-body', this.$el).html(args.body);

        if (!args.confirm) {
          args.confirm = 'Continue'
        }

        $('#btn-nav-ok', this.$el).html(args.confirm);

      },
      close : function() {
        this.$el.modal('hide');
      },
      render: function(){
        this.$el.modal("show");
        BIPClient.centerModal($('.modal', this.$el))
      }
    });

    var BIPClient = {
      // static registry.  inject bipclient as a dependency to access
      // these collection
      _collections: {
        'bip' : undefined,
        'channel' : undefined,
        'domain' : undefined,
        'pod' : undefined,
        'bip_descriptions' : undefined
      },

      // these pods should not appear in general pods list
      // and are handled by v_functions_list
      _functionPods : [
        'flow',
        'math',
        'templater',
        'time',
        'crypto',
        'dataviz'
      ],

      // ptr or channel id has underlying container and
      // should be treated as a channel.  schema's don't provide
      // this info as anything can be a channel, but it's overriden
      // in UI.
      _containerActions : [
        'syndication.subscribe',
        'syndication.list',
        'syndication.feed',
        'flow.counter',
        'flow.delta'
//        'email.smtp_forward'
      ],

      // these action pointers should have a 'parser' feature injected
      // @todo implement a schema condition
      _parsableActions : [
        'flow.text2json',
        'flow.xml2json',
        'scriptr.run_script',
        'flow.generator'
      ],

      _auth : null,
      _transformCache : {},
      _params : undefined,
      _token : undefined,
      _createToken : undefined,
      _mounted : false,
      _plans : {},
      setCollection: function(target, collection) {
        this._collections[target] = collection;
      },
      getCollection: function( target ){
        return this._collections[target];
      },

      find : {
        bip : function(id) {
          return BIPClient.getCollection('bip').get(id);
        },
        channel : function(id) {
          return BIPClient.getCollection('channel').get(id);
        },
        domain : function(id) {
          return BIPClient.getCollection('domain').get(id);
        },
        share : function(id) {
          return BIPClient.getCollection('bip_share').get(id);
        },
        pod : function(id) {
          return BIPClient.getCollection('pod').get(id);
        }
      },

      isParsable : function(actionPtr) {
        return -1 !== this._parsableActions.indexOf(actionPtr);
      },

      getParamNames : function(func) {
        var fnStr = func.toString().replace(/((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg, '');
        var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match( /([^\s,]+)/g);

        if (result === null) {
           result = [];
        }

        return result;
      },

      decorateChannels : function() {
        var tokens, self = this;
        if (this._collections.pod.length > 0 && this._collections.channel.length > 0) {
          this._collections.channel.each(function(channel) {
            channel.attributes._emitter = self._collections.pod.getActionSchema(channel.get('action')).trigger !== 'invoke';
          });
        }
      },

      getChannel : function(cid) {
        var channel = this._collections.channel.get(cid);
        if (channel) {
          channel._action = this._collections.pod.getActionSchema(channel.get('action'));
          // massage missing properties
          if (!channel._action.imports.properties) {
            channel._action.imports.properties = {};
          }

          if (!channel._action.exports.properties) {
            channel._action.exports.properties = {};
          }

          if (!channel._action.config.properties) {
            channel._action.config.properties = {};
          }
        }
        return channel;
      },

      setCredentials : function(username, password, endpoint) {
        var self = this;
        if (!username && !password && !endpoint) {
          self._mounted = false;
          this._params.endpoint_override = null;
          $.ajaxSetup({
            xhrFields: {
              withCredentials: true
            },
            crossDomain: true,
            beforeSend: function (xhr) {
              //xhr.withCredentials = true;
              xhr.setRequestHeader('Authorization', 'Basic ' +
                self._auth.api_token_web);
              return xhr;
            }
          });
        } else {
          this._params.endpoint_override = endpoint;
          self._mounted = true;
          $.ajaxSetup({
            xhrFields: {
              withCredentials: true
            },
            crossDomain: true,
            beforeSend: function (xhr) {
              //xhr.withCredentials = true;
              xhr.setRequestHeader('Authorization', "Basic " + $.base64.encode(username + ':' + password));
              return xhr;
            }
          });
        }
      },

      getUserPlan : function() {
        return this._plans[userSettings.account_level];
      },

      selectPlanRoute : function(reason, message) {
        var location = '/plans?reason=' + reason;
        if (message) {
          location += '&msg=' + message;
        }
        window.location = location;
      },

      bipsExceedPlan : function() {
        var userPlan = this.getUserPlan();
        if (userPlan) {
          return (Object.keys(this._plans).length ?
            this.getCollection('bip').length >= userPlan.num_bips
            :
            false);
        } else {
          return false;
        }
      },

      init: function() {
        var self = this,
        deferred = $.Deferred();
        this._params = BIPClientParams;

        // get session token
        var url = '/auth/who';
        $.ajax({
          url : url,
          success : function(resData) {
            self._auth = JSON.parse(resData);
            self._token = self._auth.api_token;
            self.setCredentials();

            // create session
            $.ajax({
              url : self.getEndpoint() + '/login',
              success : function() {
            	 window.postMessage(JSON.stringify(["client_loaded"]), window.location.origin)
                deferred.resolve();
              },
              error : function() {
                deferred.reject();
              }
            });
          },
          error : function() {
            deferred.reject();
          }
        });

        this.authStatusChangeEvent = new ClientEvent('auth_status');

        window.addEventListener(
          'bip.authstatus.change',
          function(ev) {
            var d = ev.detail;
            self.authStatusChange(d.provider, d.status);
            if ('accepted' === d.status) {
              self.growl(d.provider + ' pod enabled');
            } else if ('denied' === d.status) {
              self.growl(d.provider + ' pod disabled');

            } else {
              self.growl('Access Denied', 'error');
            }
          }
        );

        // get plans
        this._request(
          null,
          BIPClient.getEndpoint() + '/rpc/permissions/plans',
          'GET',
          function(resData, payload) {
            var userPlan;
            self._plans = resData;

            userPlan = self.getUserPlan();

            _.each(resData, function(plan, planName) {
              plan.name = planName;
            });

            if (userPlan && userPlan.name === 'user') {
              $('#upgrade-button').show();
            }
          },
          function(xhr_status, status, errText, payload) {
          },
          true
        );

        return deferred;
      },

      // lots of weird oatuh vectors, subscribe to the newsletter.
      authStatusChange : function (provider, newstatus, next) {
        var model = this._collections['pod'].get(provider),
        self = this;

        model.attributes.auth.status = newstatus;
        model.trigger('change');
        if (next) {
          next(model);
        }
        this._collections['pod'].fetch({
          success : function() {
            self.authStatusChangeEvent.trigger({
              provider : provider,
              newstatus : newstatus
            });
          }
        });
      },

      logout : function(ev) {
        $.ajax({
          url : this.getEndpoint() + '/logout',
        });
      },

      callHTTPBip : function(httpBip, payload, next, method) {
        var url = httpBip.get('_repr'),
        headers = {},
        config = httpBip.get('config');

        var APIHost = BIPClientParams.endpoint.replace('http://', ''),
          tokens = APIHost.split(':');

        url = url.replace(tokens[0] + '/', APIHost + '/');

        for (var k in payload) {
          if (payload.hasOwnProperty(k)) {
            if (!payload[k]) {
              delete payload[k];
            }
          }
        }

        if (config.auth && config.auth === 'basic') {
          url = url.replace(
            /^(http(s?):\/\/)/,
            '$1' + config.username + ':' + config.password + '@'
          )
        }

        headers.Authorization = "Basic " + this._auth.api_token_web;

        var proxyUrl = BIPClientParams.endpoint + '/rpc/pod/http/request/proxy?url=' + url;

        $.ajax(
        {
          type : method || 'GET',
          url : proxyUrl,
          data : JSON.stringify(payload),
          contentType: "application/json",
          headers: headers,
          success : function() {
            next(false);
          },
          error : function(resp) {
            next(resp.responseText);
          }
        });

      },

      callRPCAccount : function(href, next) {
        //href = href.replace('.io/', '.io:5000/');
        var self = this,
        /*
          url = href.replace(
            /^(http(s?):\/\/)/,
            '$1' + $.base64.decode(this._auth.api_token_web) + '@'
          ),
        */
          reqStruct = {
            type: 'GET',
            contentType: 'application/json',
            dataType: 'json',
            url: href,
            headers: {
              "Authorization": "Basic " + this._auth.api_token_web
            },
            success: function(resData, status, xhr) {
              if (next) {
                next(resData);
              }
            },
            error: function(xhr, status, errText) {
              var message = errText;
              try {
                message = JSON.parse(xhr.responseText).message
              } catch (e) {
                if (message.message) {
                  message = message.message;
                } else {
                  message = errText;
                }
              }
              self.growl(message, 'error');
            }
          };
        return $.ajax(reqStruct);
      },

      openRenderer : function(cid, renderer) {
        var channel = this.getCollection('channel').get(cid),
        url;

        if (channel) {
          url = _.findWhere(channel.get('_links'), { name : renderer} )._href
          window.open(
            url.replace(
              /^(http(s?):\/\/)/,
              '$1' + $.base64.decode(this._auth.api_token_web) + '@'
              )
            );
        }
      },

      getRendererURI : function(cid, renderer) {
        var channel = this.getCollection('channel').get(cid),
        url;

        if (channel) {
          url = _.findWhere(channel.get('_links'), { name : renderer} )._href.replace(
            /^(http(s?):\/\/)/,
            '$1' + $.base64.decode(this._auth.api_token_web) + '@'
            );
        }
        return url;
      },

      /**
         *
         */
      getEndpoint : function() {
        return this._params.endpoint_override ? this._params.endpoint_override  : this._params.endpoint;
      },

      //  request handler
      _request : function(payload, methodAPI, methodHTTP, onSuccess, onFail, useToken) {
        var self = this;
        var payload = null == payload ? payload : JSON.stringify(payload);

        if (undefined == useToken || true == useToken) {
          useToken = true;
        } else {
          useToken = false;
        }

        var reqStruct = {
          type: methodHTTP,
          contentType: 'application/json',
          dataType: 'json',
          url: methodAPI,
          success: function(resData, status, xhr) {
            if (undefined != onSuccess) {
              onSuccess(resData, payload);
            }
          },
          error: function(xhr, status, errText) {
            if (undefined !== onFail) {
              onFail(xhr.status, status, errText, payload);
            }
          }
        };

        if (null !== payload) {
          reqStruct.data = payload;
        }

        $.ajax(reqStruct);
      },

      getResourceURL: function(name, modelRef) {
        var urlStr = BIPClient.getEndpoint() + '/rest/' + name;
        if (undefined != modelRef.id) {
          urlStr += '/' + modelRef.id;
        }

        return urlStr;
      },

      getPodDescriptions : function() {
        return BIPClient.getEndpoint() + '/rpc/describe/pod';
      },

      getBipDescriptions : function() {
        return BIPClient.getEndpoint() + '/rpc/describe/bip';
      },

      defEnumeratorUnpack : function(props) {
        var c, p, ret = [], ptr, defs = props.definitions;

        for (p in props.properties) {
          ptr = {
            'id'  : p,
            'label' : props.properties[p].title || props.properties[p].description,
            data : []
          };

          if (props.properties[p].oneOf) {
            for (var i = 0; i < props.properties[p].oneOf.length; i++) {
              c = props.properties[p].oneOf[i];
              if (c['$ref']) {
                // extract properties
                if (/^#\/definitions\//.test(c['$ref'])) {
                  var def = c['$ref'].replace('#/definitions/', '');
                  d = defs[def];
                  if (d && d['enum']) {
                    for (var j = 0; j < d['enum'].length; j++) {
                      ptr.data.push({
                        label : d['enum_label'][j],
                        value : d['enum'][j]
                      });
                    }
                  }
                }
              }
            }
            ret.push(ptr);
          }
        }
        return ret;
      },


      getExports : function(domain, id) {
        var desc, channel, pod, triggerExports;

        // channel id export lookup
        if ('channel' === domain || 'trigger' === domain) {
          // get channel by channelId
          channel = this.getCollection('channel').get(id);

          // get action or emitter exports by channel pod.action path
          desc = this.getCollection('pod').getActionSchema(channel.get('action')).exports;

          // inject source exports
          if ('trigger' === domain) {
            var bipExports = this.getCollection('bip_descriptions').get(domain).get('exports');

            if (!desc.definitions) {
              desc.definitions = bipExports.definitions;
            }

            _.each(bipExports.definitions, function(prop, key) {
              desc.definitions[key] = prop;
            });

            if (!desc.properties) {
              desc.definitions = bipExports.properties;
            }

            _.each(bipExports.properties, function(prop, key) {
              desc.properties[key] = prop;
            });

          }

        } else if ('http' === domain) {
          desc = this.getCollection('bip_descriptions').get(domain).get('exports');
          desc.id = domain;
          (((desc.properties._bip || {}).properties || {})._rep || {}).title = 'URL' ;
        // get configured exports
        } else {
          desc = this.getCollection('bip_descriptions').get(domain).get('exports');
          desc.id = domain;
        }

        if ('smtp' === domain) {
        	(((desc.properties._bip || {}).properties || {})._rep || {}).title = 'Email Address' ;
        }

        // debugger;
        return JSON.parse(JSON.stringify(desc));
      },

      //
      // Retrieves transform hints from action->action
      //
      // @param next callback(error, response)
      getTransformHint : function(context, from, to, next) {
        var cacheKey = from + '_' + to,
        self = this;
        if (!this._transformCache[cacheKey]) {
          this._request(
            null,
            BIPClient.getEndpoint() + '/rpc/bip/get_transform_hint?from=' + from + '&to=' + to,
            'GET',
            function(resp) {
              self._transformCache[cacheKey] = resp.transform;
              next(false, self._transformCache[cacheKey], context);
            },
            function(xhrStat, status, errText) {
              next(true, {}, context);
            }
            );
        } else {
          next(false, this._transformCache[cacheKey], context);
        }
      },

      getResourceName: function(name, page, page_size, order_by, search_by, mode) {
        if (!mode) {
          mode = 'rest';
        }

        var urlStr = BIPClient.getEndpoint() + '/' + mode + '/' + name,
        params,
        filter = '';

        if (undefined == page) {
          page = 1;
        }

        if (undefined == page_size) {
          page_size = 10;
        }

        if (undefined == order_by) {
          order_by = 'recent';
        }

        params = {
          page: page,
          page_size: page_size,
          order_by : order_by
        };

        if (undefined != search_by) {
          for (key in search_by) {
            if ('' != filter) {
              filter += ',';
            }
            filter += key + ':' + search_by[key];
          }
          params.filter = filter;
        }

        return urlStr + '?' + $.param(params);
      },

      getSettingsUrl : function() {
        return this.getResourceURL('account_option', {
          id : this.getSettings().id
        });
      },

      getSettingsId : function() {
        return BIPClientParams.settings.id;
      },

      getSettings : function() {
        return userSettings;
      },

      domainVerify : function(domainID, cb) {
        this._request(
          null,
          BIPClient.getEndpoint() + '/rpc/domain/confirm/' + domainID,
          'GET',
          function(resData, payload) {
            cb(false, resData);
          },
          function(xhr_status, status, errText, payload) {
            cb(true, errText);
          },
          true
        );
      },

      triggerBip : function(id) {
        this._request(
          null,
          BIPClient.getEndpoint() + '/rpc/bip/trigger/' + id,
          'GET',
          function(resData, payload) {
            BIPClient.growl('Trigger Complete');
            BIPClient.getCollection('bip').fetch();
          },
          function(xhr_status, status, errText, payload) {
            BIPClient.growl(errText || 'Not Runnable', 'error');
          },
          true
          );
      },

      share : function(model, cb) {
        this._request(
          model,
          BIPClient.getEndpoint() + '/rpc/bip/share',
          'POST',
          function(resData, payload) {
            cb(false, resData);
          },
          function(xhr_status, status, errText, payload) {
            if (409 == xhr_status) {
              cb(true, 'Share URL Is Already In Use')
            } else {
              cb(true, errText);
            }
          },
          true
          );
      },

      getShareURL : function(id) {
        return BIPClient.getEndpoint() + '/rpc/bip/share/list?filter=id:' + id;
      },

      /*getSharePageUrl : function(share) {
        return

      }*/

      // @todo this whole interface is crap.  After the RPC create, it should
      // be treated as a restful service.
      unShare : function(id, cb) {
        this._request(
          null,
          BIPClient.getEndpoint() + '/rpc/bip/unshare/' + id,
          'GET',
          function(resData, payload) {
            cb(false, resData);
          },
          function(xhr_status, status, errText, payload) {
            cb(true, errText);
          },
          true
          );
      },

      incShare : function(id) {
        this._request(
          null,
          BIPClient.getEndpoint() + '/rpc/bip/share/inc/' + id,
          'GET',
          function(resData, payload) {
          },
          function(xhr_status, status, errText, payload) {
          },
          true
          );
      },

      getShares : function() {
        this._request(
          null,
          BIPClient.getEndpoint() + '/rpc/bip/share/' + model.id ,
          'GET',
          function(resData, payload) {
            cb(false, resData);
          },
          function(xhr_status, status, errText, payload) {
            cb(true, errText);
          },
          true
          );
      },

      errParse : function(res) {
        var errStruct = {};
        if (res.responseText) {
          var struct = $.parseJSON(res.responseText)
          if (struct.errors) {
            errStruct.status = struct.status;
            errStruct.msg = struct.errors.name.message;
          }
        }
        return errStruct;
      },

      growl : function(message, level) {
        level = level || 'success';
        $.bootstrapGrowl(
          ('error' === level ? '<i class="icon-exclamation-sign"></i> ' : '') + message.replace(/\n/g, '<br/>'),
          {
            //ele : '#subnavbar',
            ele : 'body',
            offset: {
              right : Math.floor($(window).width() - $('.user button').offset().left - $('.user button').outerWidth()),
              top : 62
            },
            type : level || 'success',
            delay : 3000,
            width: 385,
            allow_dismiss : false,
            align : 'right'
          }
          );
      },

      flattenObject : function(obj, delimiter, includePrototype, container, key) {
        container = container || {};
        key = key || "";
        delmiter = delimiter || '/';

        for (var k in obj) {
          if (includePrototype || obj.hasOwnProperty(k)) {
            var prop = obj[k];
            if (prop && this.isObject(prop)) {
              this.flattenObject(prop, delimiter, includePrototype, container, key + k + delimiter);
            }
            else {
              container[key + k] = prop;
            }
          }
        }

        return container;
      },

      deepClone: function(obj) {
        var clone = _.clone(obj);

        _.each(clone, function(value, key) {
          if (_.isObject(value)) {
            clone[key] = BIPClient.deepClone(value);
          }
        });

        return clone;
      },

      htmlEncode : function(value) {
        return $('<div/>').text(value).html();
      },

      htmlDecode : function(value) {
        return $('<div/>').html(value).text();
      },

      rotateLeft : function(arr, num) {
        return [].concat(arr.splice(num, arr.length)).concat(arr);
      },

      distributeManifest : function(dict, limit) {
        var distribution = Array.apply(null, new Array(limit)).map(Object.prototype.valueOf, {}),
          numElements = dict.normedManifest.length,
          maxDeg = 360,
          angle = 0,
          deg = maxDeg / distribution.length,
          offs,
          step = maxDeg / numElements;

        for (var i = 0; i < numElements; i++) {
          offs = Math.floor(angle / deg);
          distribution[offs] = dict.normedManifest[i]
          angle += step;
          if (angle > maxDeg)  {
            angle = 45;
          }
        }

        // custom rotations
        if (numElements == 5) {
          distribution = this.rotateLeft(distribution, 1);
        } else {
          // random rotation
//          distribution = this.rotateLeft(distribution, Math.floor(Math.random() * limit));
        }

        dict.normedManifest = distribution;
        return dict;
      },

      selectContents : function(ev) {
        var el = ev.currentTarget;
        // firefox
        if(document.createRange) {
          rangeToSelect = document.createRange();
          rangeToSelect.selectNode(el);
          curSelect = window.getSelection();
          curSelect.addRange(rangeToSelect);
          return false;
        }
        // ie
        if(document.body &&
          document.body.createTextRange) {
          range = document.body.createTextRange();
          range.moveToElementText(el);
          range.select();
          return false;
        }
      },

      signIn : function(username, password, next) {
        var reqStruct = {
          type: 'POST',
          contentType: 'application/json',
          dataType: 'json',
          data: JSON.stringify({
            'username' : username,
            'password' : password
          }),
          url: '/auth',
          success: function(resData, status, xhr) {
            next();
          },
          error: function(xhr, status, errText) {
            next('Please Retry');
          }
        };

        $.ajax(reqStruct);
      },

      confirmNavModal : function(opts) {
        var confirmModal = new ConfirmModalClass(opts);
        confirmModal.render();
      },

      regUUID : /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,

      isUUID : function(val) {
          return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(val);
      },

      _getPtr : function(ptr) {
        if (this.isUUID(ptr)) {
          ptr = this.find.channel(ptr).get('action');

        } else {
          var tokens = ptr.split('.');
          ptr = tokens[0] + '.' + tokens[1];

        }

        return ptr.toLowerCase();
      },

      // pod is considered 'functional' and not in regular pod lists
      isFunctionPod : function(ptr) {
        ptr = this._getPtr(ptr);

        var tokens = ptr.split('.'),
          ok = false,
          pod = -1 !== this._functionPods.indexOf(tokens[0]); // && this.getCollection('pod').get(tokens[0]);

        // flow.generator is a special case emitter and shouldn't
        // be rendered as a function
        if ('flow' === tokens[0] && 'generator' === tokens[1]) {
          return false;
        }

        return pod;
      },

      isContainerAction : function(ptr) {
        ptr = this._getPtr(ptr);
        return -1 !== this._containerActions.indexOf(ptr);
      },

      realClone : function(obj) {
        return JSON.parse(JSON.stringify(obj));
      },

      centerModal : function($el) {
        $el.removeAttr('height');

        var $height = $el.height();
//        if (!$el.attr('height')) {
          $el.addClass('center-absolute').height($height);
//        }
      },

      _setEmptyFlag : function($el) {
        var empty = !$el.val().replace(/\s*/, ''),
          $parent = $el.parent();

        if (empty) {
          $parent.attr('empty', true);
        } else {
          $parent.removeAttr('empty');
          $el.removeClass('invalid');
        }
      },

      bindEmptyInputStyles : function($el) {
        var self = this;

        $('[required] input', $el).parent().removeAttr('empty');

        $('[required] input:text[value=""]', $el).parent().attr('empty', true);

        $('[required] input', $el).bind('propertychange keyup input paste', function() {
          self._setEmptyFlag($(this));
        });

      },

      schema2JSON : function(schema) {
        var container, value;

        if ('object' === schema.type) {
          container = {};
          for (var k in schema.properties) {
            if (0 !== k.indexOf('_')) {
              container[k] = arguments.callee.call(this, schema.properties[k]);
            }
          }
          return container;

        } else if ('array' === schema.type) {
          container = [];
          container.push(arguments.callee.call(this, schema.items));
          return container;

        } else if ('number' === schema.type) {
          return 0

        } else if ('boolean' === schema.type) {
          return true;

        } else if ('string' === schema.type) {
          return '';
        } else {
          return {};
        }
      },

      ucFirst : function(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
      },

      getReqParam : function(param) {
        var url = decodeURIComponent(window.location.search.substring(1)),
          params = url.split('&'),
          paramName,
          i;

        for (i = 0; i < params.length; i++) {
          paramName = params[i].split('=');

          if (paramName[0] === param) {
            return paramName[1] === undefined ? true : paramName[1];
          }
        }
      },

      isTruthy : function(value) {
        var truthy = Number(value);
        return isNaN(truthy) ? ('true' === value || true === value) : !!truthy;
      },

      isFalsy : function(value) {
        var falsy = Number(value);
        return isNaN(falsy) ? ('false' === value || false === value) : !falsy;
      },

      isBool : function(value) {
        return _.isBoolean(value) || this.isTruthy(value) || this.isFalsy(value);
      },

      getSiteURL : function() {
        return BIPClientParams.proto + '://' + BIPClientParams.hostname;
      }
    };

    $('#logout-btn').on('click', function(ev) {
      BIPClient.logout(ev);
    });

    return BIPClient;
  });
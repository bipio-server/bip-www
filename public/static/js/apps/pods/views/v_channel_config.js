define([
  'underscore',
  'backbone',
  'bipclient'
  ], function(_, Backbone, BipClient){

    var entityMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': '&quot;',
      "'": '&#39;',
      "/": '&#x2F;'
    };

    var ChannelConfigView = Backbone.View.extend({
      tplActionEntity : _.template($('#tpl-action-entity').html()),
      initialize: function(containerSelector) {
        _.bindAll(
          this,
          'serialize',
          '_htmlEnumDef',
          '_decodeEntities',
          '_attachChannelOptions',
          '_isTruthy',
          '_processQueue',
          '_renderFromQueue',
          '_unpackValues'
          );
      },

      _rpcQueues : {},

      _unpackValues : function(results, qStruct) {
        var customResults = [],
          multiOptions;

        results = results || [];

        // @todo unpack label
        // unpack key
        var keyPath = qStruct.key.split('/'),
          ptr = results,
          key;

        if (keyPath.length > 1) {
          for (var i = 0; i < keyPath.length; i++) {
            if (i === keyPath.length - 1) {
              key = keyPath[i]
            } else {
              if ('*' === keyPath[i]) {
                ptr = _.values(ptr);
              } else {
                ptr = ptr[keyPath[i]]
              }
            }
          }
          results = ptr;
        } else {
          key = qStruct.key;
        }

        if (qStruct.value) {
          var searchStruct = {}
          searchStruct[key] = qStruct.value;

          if (_.where(results, searchStruct).length === 0) {
            var customResult = {};

            if ($.isArray(qStruct.value)) {
              multiOptions = qStruct.value;
              // inject anything not present in the response,
              // but injected by the user.
              for (var i = 0; i < qStruct.value.length; i++) {
                if (!_.filter(results, function(r) {
                  return r[key] === qStruct.value[i]
                }).length) {
                  customResult[key] = qStruct.value[i];
                  customResults.push(customResult);
                }
              }
            } else {

              customResult[key] = qStruct.value;
              customResults.push(customResult);
            }
          }
        }

        return [ key, results.concat(customResults), multiOptions ];
      },

      _renderFromQueue : function(results, qStruct) {
        var self = this,
          $select = $('#channel_' + qStruct.podName + '-' + qStruct.actionName + '-' + qStruct.configItem);
          $select.empty();

        var unpacked = this._unpackValues(results, qStruct),
          key = unpacked[0],
          derivedResults = unpacked[1], multiOptions = unpacked[2];

        var selected,
          values = [],
          value,
          select2Opts = {
            dropdownAutoWidth : true,
            data : [],
            sortResults : function(data) {
              return data.sort().reverse();
            }
          },
          requiredFields = BipClient.find.pod(qStruct.podName).getAction(qStruct.actionName).imports.required,
          isRequired = requiredFields && -1 !== requiredFields.indexOf(qStruct.configItem);

        if (!isRequired) {
          select2Opts.allowClear = true;
          select2Opts.placeholder = 'None Selected';
        }

        if ( $select.attr('multiple')) {
          select2Opts.multiple = true;
        }

        var defaultValue;

        for (var i = 0; i < derivedResults.length; i++) {
          r = derivedResults[i];

          value = key ? r[key] : r;

          values.push(value);

          if (multiOptions) {
            selected = (-1 !== multiOptions.indexOf(value));
            if (selected) {
              if (!defaultValue) {
                defaultValue = [];
              }
              defaultValue.push(value);
            }
          } else {
            selected = qStruct.value == value;
            if (selected) {
              defaultValue = value;
            }
          }

          select2Opts.data.push({ id : value, text : (r[qStruct.label ? qStruct.label : key] || value) });
        }

        $select.select2(select2Opts).select2('val', defaultValue);

        if (!$select.siblings('.btn-refresh').length) {

          var $refresh = $('<button data-loading-text="Loading..." class="btn-refresh btn btn-mini"><i class="icon-refresh"></i> Refresh</button>');

          // setup data refresh
          $select.parent().prepend('&nbsp;&nbsp;').prepend($refresh);

          (function($select, qStruct) {
            $refresh.on('click', function() {
              var $this = $(this),
                defaultValue = $select.select2('val');

              $this.button('loading');
              self._processQueue(
                qStruct,
                function(results, qStruct) {
                  $this.button('reset');
                  var unpacked = self._unpackValues(results, qStruct),
                    key = unpacked[0],
                    results = unpacked[1],
                    multiOptions = unpacked[2],
                    value,
                    data = [];

                  var sData = $select.data('select2').opts.data;
                  sData.length = 0;

                  _.each(results, function(obj) {
                    value = key ? obj[key] : obj;
                    sData.push({ id : value, text : (obj[qStruct.label ? qStruct.label : key] || value) });
                  });

                  $select.select2('val', defaultValue);
                },
                true
              );
              return false;
            });

          })($select, qStruct);
        }

        this.trigger('attribute:rendered', qStruct.configItem, values);
      },

      _processQueue : function(qStruct, next, refresh) {
        var self = this;
        if (!this._rpcQueues[qStruct.href] || refresh) {
          var pStruct = {
            results : null,
            req : BipClient.callRPCAccount(
              qStruct.href,
              function(results) {
                pStruct.results = results;
              }
            )
          };
          self._rpcQueues[qStruct.href] = pStruct;
        }

        (function(qStruct) {
          if (self._rpcQueues[qStruct.href].results && !refresh) {
              next(self._rpcQueues[qStruct.href].results, qStruct);
          } else {
            self._rpcQueues[qStruct.href].req.then(function(results, state, xhr) {
              next(results, qStruct);
            });
          }
        })(qStruct);
      },

      _htmlEnumDef : function(name, config, action, channel, namespace, actionName, podName) {
        var optEntity,
        self = this,
        pathTokens,
        ptr,
        html = '',
        inputName,
        label,
        enumDefault,
        cConfig = channel.config,
        renderQueue = {
          href : '',
          key : '',
          label : '',
          value : channel.config[name],
          podName : podName,
          actionName : actionName,
          configItem : name
        },
        context,
        paths;

        var iterator, multiSelect = false;

        if (config.oneOf) {
          iterator = config.oneOf;
        } else if (config.anyOf) {
          multiSelect = true;
          iterator = config.anyOf;
        }

        for (var i = 0; i < iterator.length; i++) {
          optEntity = iterator[i];
          if (optEntity['$ref']) {
            // either action or pod renderer paths
            context = optEntity['$ref'].indexOf('#') === 0
            ? action
            : BipClient.getCollection('pod').get(podName).toJSON();

            paths = optEntity['$ref'].replace(/^#\//, '').split('#');

            pathTokens = paths[0].split('/');
            if (!pathTokens[0]) {
              pathTokens.shift();
            }

            for (var j = 0; j < pathTokens.length; j++) {
              ptr = ptr ? ptr[pathTokens[j]] : context[pathTokens[j]];

              if (ptr && ptr._href) {
                renderQueue.href = ptr._href;
              }

              if ( j === pathTokens.length - 1 ) {
                if (/^{.*}$/.test(pathTokens[j])) {
                  renderQueue.key = pathTokens[j].replace(/[{}]/g, '');
                  inputName = 'config#' + (namespace ? namespace + '/' + name : name);
                  html += '<div '
                    + (multiSelect ? 'multiple' : '')
                    + ' name="' + inputName
                    + '" id="channel_' + podName + '-' + actionName + '-' + name + '"></div>';
                } else {

                  if (ptr && ptr['enum']) {
                    inputName = 'config#' + (namespace ? namespace + '/' + name : name);

                    html += '<div id="config-group-' + name + '" class="btn-group" data-toggle="buttons-radio">';

                    // hidden radio binding. ugh.
                    html += '<input type="hidden" name="' + inputName + '" id="' + inputName + '" value="' + (renderQueue.value || ptr['default'] || '') + '" />';

                    // setup 'radio's
                    for (var j = 0; j < ptr['enum'].length; j++) {
                      enumDefault = cConfig[name] ? cConfig[name] : ptr['default']

                      label = (ptr['enum_label'] && ptr['enum_label'][j]) ? ptr['enum_label'][j]  : ptr['enum'][j];

                      html += '<button type="button" name="' + inputName + '"' +
                      'class="btn btn-mini btn-primary ' + ( (enumDefault && enumDefault == ptr['enum'][j]) ? 'active"' : '' ) +
                      '" data-selection="' + (ptr['enum'][j]) + '">' + (label || '') + '</button>';
                    }
                    html += '</div>';
                  } else {
                    inputName = 'config#' + (namespace ? namespace + '/' + name : name);
                    html += '<div '
                      + (multiSelect ? 'multiple' : '')
                      + ' name="' + inputName
                      + '" id="channel_' + podName + '-' + actionName + '-' + name + '"></div>';
                  }
                }
              }
            }

            // looking into a renderer
            if (paths.length === 2) {
              renderQueue.key = paths[paths.length - 1].replace(/[{}]/g, '');
              inputName = 'config#' + (namespace ? namespace + '/' + name : name);
              html += '<div '
                + ' name="'
                + inputName
                + '" id="channel_' + podName + '-' + actionName + '-' + name
                + '"></div>';
            }
          }
        }

        // shortcut the schema traversal, label pointers are WIP.
        if (config.label && config.label['$ref']) {
          renderQueue.label = config.label['$ref'].split('/').pop().replace(/[{}]/g, '');
        }

        if (BipClient.find.pod(podName).isAuthed() && renderQueue.href) {
          //
          setTimeout(function() {
            self._processQueue(renderQueue, self._renderFromQueue);
          }, 100);
        }

        return html;
      },

      _encodeEntities : function(str) {
        return String(str).replace(/[&<>"'\/]/g, function (s) {
          return entityMap[s];
        });
      },

      _decodeEntities : function() {
        var element = document.createElement('div');

        function decodeHTMLEntities (str) {
          if(str && typeof str === 'string') {
            // strip script/html tags
            str = str.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
            str = str.replace(/<\/?\w(?:[^"'>]|"[^"]*"|'[^']*')*>/gmi, '');
            element.innerHTML = str;
            str = element.textContent;
            element.textContent = '';
          }

          return str;
        }

        return decodeHTMLEntities;
      }(),

      _isTruthy : function(value) {
        var truthy = Number(value);
        return isNaN(truthy) ? ('true' === value || true === value) : !!truthy;
      },

      // looks into the config schema and builds some friendly inputs based
      // on the json schema, adding to config.properties.{property_name}._html
      //
      // @todo deprecate all arguments but for channel and propFilter
      _attachChannelOptions : function(action, channel, actionName, podName, propFilter) {
        var config,
          channel = channel.toJSON ? channel.toJSON() : channel,
          defs = (action.config && action.config.properties) ? action.config.properties : {},
          c, d, defaultVal = '';

        for (key in defs) {
          if (!propFilter || propFilter && -1 !== propFilter.indexOf(key) ) {
            config = action.config.properties[key];
            config._html = '';
            if (undefined !== config['default']) {
              defaultVal = config['default'];
            } else {
              defaultVal = '';
            }

            if (config.type === 'string') {
              if (config.oneOf) {
                config._html = this._htmlEnumDef(key, config, action, channel, null, actionName, podName)
              } else {
                config._html = '<input class="channel-config-item input full-width" id="channel_' + key + '" value="' + (channel.config[key] || defaultVal) + '" type="text" name="config#' + key + '" placeholder="' + (config['default'] || '') + '"/>';
              }

            } else if (config.type === 'integer' || config.type === 'number') {
              if (config.oneOf) {
                config._html = this._htmlEnumDef(key, config, action, channel, null, actionName, podName)
              } else {
                config._html = '<input class="channel-config-item input input-small" id="channel_' + key + '" value="' + (channel.config[key] || defaultVal) + '" type="text" name="config#' + key + '" placeholder="' + (config['default'] || '') + '"/>';
              }

            } else if (config.type == 'object') {

              config._html = '';
              for (objKey in config.properties) {
                config._html += '<span class="label">' + objKey + '</span>';
                config._html += this._htmlEnumDef(objKey, config, action, channel, key, actionName, podName);
              }

            } else if (config.type == 'text' || config.type == 'mixed') {
//              config._html = '<textarea name="config#' + key + '" placeholder="' + (config['default'] || '') + '">' + this._decodeEntities(channel.config[key] || '') + '</textarea>';
              config._html = '<textarea name="config#' + key + '" placeholder="' + (config['default'] || '') + '">' + (channel.config[key] || '') + '</textarea>';

            } else if (config.type == 'boolean') {
              var radioName = 'config#' + key,
              cConfig = channel.config,
              enumDefault = (undefined !== cConfig[key] && '' !== cConfig[key] ? this._isTruthy(cConfig[key]) : this._isTruthy(config['default']));

              config._html += '<div id="config-group-' + radioName + '" class="btn-group" data-toggle="buttons-radio">';

              // hidden radio binding. ugh.
              config._html += '<input type="hidden" name="' + radioName + '" value="' + (enumDefault || '') + '" />';

              config._html += '<button type="button" value="1" name="config#' + (key) + '"' +
              'class="btn btn-mini btn-primary ' + (enumDefault ? 'active' : '') +
              '" data-selection="1">ON</button>';

              config._html += '<button type="button" value="0" name="config#' + (key) + '"' +
              'class="btn btn-mini btn-primary ' + (!enumDefault ? 'active' : '') +
              '" data-selection="0">OFF</button>';
              config._html += '</div>';

            } else if (config.type === 'array') {
              config._html = this._htmlEnumDef(key, config, action, channel, null, actionName, podName)
            }
          }
        }

        return action;
      },

      _updateChannelOptions : function(channel) {
        // rebuild htmls for config items
        var action = this._attachChannelOptions(
            channel.getAction(),
            channel,
            channel.getAction().name,
            channel.getPodName()
          ),
          config = channel.get('config');

        if (action && action.config && action.config.properties) {
          _.each(action.config.properties, function(prop, key) {
            var html = prop._html,
              id = $(html).attr('id');

            // selects and button groups handled a little differently and not
            // explicitly replaced
            if (-1 !== html.indexOf('<div')) {
              $(id).select2(key, config[key]);

            } else if (-1 !== html.indexOf('btn-group')) {
              $('#' + id + ' button[data-selection=' + config[key] + ']').click();

            } else {
              elName = $(html).attr('name'),
              $('[name=' + elName + ']').replaceWith(html);

            }
          });
        }
      },

      // renders the list container
      render: function(pod, actionName, actionSchema, channel, entityClass, propFilter) {
        return this.tplActionEntity({
          name : pod.get('name') + '.' + actionName,
          podName : pod.get('name'),
          actionName : actionName,
          id : pod.get('name') + '-' + actionName,
          schema : this._attachChannelOptions(actionSchema, channel, actionName, pod.get('name'), propFilter),
          active_class : entityClass
        });
      },

      serialize : function(id) {
        if (!id) id = '#share-form'
        var struct = {},
        values = $(id).serializeArray();

        var path, ref, value, name, tokens, $ovr;

        _.each($(id + ' div.select2-offscreen'), function(el) {
          values.push({
              name : $(el).attr('name'),
              value : $(el).val()
            }
          );
        });

        for (var i = 0; i < values.length; i++) {
          value = values[i].value;
          tokens = values[i].name.split('#');

          $ovr = $('#group-' + tokens[1] + ' .transform-override');

          // ignore when a transform override set
          if (!$ovr.length && $ovr.hasClass('active')) {
            continue;
          }

          // qualified object path
          if (tokens.length > 1) {
            name = tokens[0];
            if (!struct[name]) {
              struct[name] = {};
            }
            ref = struct[name];

            path = tokens[1].split('/');

            //
            for (var j = 0; j < path.length; j++) {
              name = path[j];
              if (j === (path.length - 1)) {
                ref[name] = value;
              } else {
                if (!ref[name]) {
                  ref[name] = {};
                }
                ref = ref[name];
              }
            }

          // literal attribute
          } else {
            name = values[i].name;
            struct[name] = value;
          }
        }
        return struct;
      }
    });
    return ChannelConfigView;
  });
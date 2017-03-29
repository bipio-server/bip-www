/**
 * Handles the hub configuration gruntwork, modal/transforms and d3 rendering
 *
 */
define([
  'd3',
  'underscore',
  'backbone',
  'bipclient',
  'apps/bipio/views/v_functions_list',
  ], function(d3, _, Backbone, BipClient, FunctionsListView){
    HubView = Backbone.View.extend({
      el: '#hub',

      _bipSource : null, // source bip type
      _actions : null,

      _currentExports : null,

      _radius : 28,

      _arrowLength : 7,

      _boundingBox : {
        top : 36,
        bottom: 10,
        left : 10,
        right : 10
      },

      _layoutConfig : {
        width : 770,
        height : 600
      },
      _mouseState: {
        upNode : null,
        downNode : null,
        upLink : null,
        downLink : null
      },
      // node/link active selections
      _selectionState : {
        link : null, // d3 node
        node : null // d3 link
      },
      _svg : null,
      _forceLayout : null,
      _link : null,
      _node : null,
      _links : [],
      _nodes : [],
      _vis : null,

      _srcHelper : null,
      _drag_line : null, // line drag vis when attaching new channels

      _functionListView : null,

      events : {
        'click svg' : 'refocus'
      },

      initialize:function (bipSource) {
        var self = this;

        _.bindAll(this,
          'render',

          'shutdown',

          'getParentsForCID',
          'getParentForCID',

          // d3
          '_redraw',

          '_tick',
          '_getNodeStruct',
          '_removeSelectedNode',
          '_setSelectedNodeParams',
          '_spliceNodeLinks',
          '_clearMouseState',
          '_mouseCtl',
          '_keyCtl',

          '_bindBipSource',
          '_addEdge',

          'addChannel',
          'selectSource',
          'setTriggerSourceParams',
          'refocus',
          'linkNodes',
          'setEmittingState',
          '_enumerateActionPointer',
          'addFunctionWidget'
        );

        this._bipSource = bipSource;

      },

      _pulseSettings : {
        fromr : 16,
        tor : 44,
        fromstroke : 4,
        tostroke : 1
      },

      render : function(hub) {
        // convert hub to a d3 graph struct
        var struct = this._hub2D3(hub),
          self = this;

        this._setDimensions();

        this._clearMouseState();

        this._actions = BipClient.getCollection('channel').getActions();

        pods = BipClient.getCollection('pod').pluck('name');
        // bip 'source' always available
        if (pods.indexOf('bipio') === -1) {
          pods.push('bipio');
        }

        // undefined node fill (config pending)
        pods.push('undefined');

        var fill = d3.scale.category20();

        // derive maximum svg width
        var el = $('<div class="' + $('#bip-setup').attr('class') + '"></div>');
        $('body').append(el);
        //this._layoutConfig.width = el.width();
        el.remove();

        // init svg
        this._svg = d3.select(this.el)
        .append("svg:svg")
        .attr("width", this._layoutConfig.width)
        .attr("height", this._layoutConfig.height)
        .attr("pointer-events", "all");

        // define arrow markers for graph links
        this._svg.append('svg:defs')
        .append('svg:marker')
        .attr('id', 'end-arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', this._arrowLength)
        .attr('markerWidth', 3)
        .attr('markerHeight', 4)
        .attr('orient', 'auto')
        .append('svg:path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', 'inherit')
        .attr("class", "arrow");

        this._svg.append('svg:defs')
        .append('svg:marker')
        .attr('id', 'end-arrow-selected')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', this._arrowLength)
        .attr('markerWidth', 3)
        .attr('markerHeight', 4)
        .attr('orient', 'auto')
        .append('svg:path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', 'inherit')
        .attr("class", "arrow_selected");

        this._vis = this._svg
        .append('svg:g')
        .on("dblclick.zoom", null)
        .append('svg:g')
        .on("mousemove", this._mouseCtl('move'))
        .on("mousedown", this._mouseCtl('down'))
        .on("mouseup", this._mouseCtl('up'))

        .on("touchmove", this._mouseCtl('touchmove'))
        .on("touchstart", this._mouseCtl('touchstart'))
        .on("touchend", this._mouseCtl('touchend'));


        this._vis.append('svg:rect')
        .attr('width', this._layoutConfig.width)
        .attr('height', this._layoutConfig.height)
        .attr('fill', 'transparent');

        // line displayed when dragging new nodes
        this._drag_line = null;
        this._drag_line = this._vis.append("line")
        .attr("class", "drag_line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", 0)
        .attr("class", "drag_line_hidden");

        d3.select('#hub-focus').on("keydown", this._keyCtl);

        if ('trigger' !== this._bipSource.get('type')) {
          this.addFunctionWidget();
        }

        this.refocus();

        this._forceLayout = d3.layout.force()
          .nodes(struct.nodes)
          .links(struct.links)
          .size([this._layoutConfig.width, this._layoutConfig.height])
          .on("tick", this._tick);

        // get layout properties
        this._nodes = this._forceLayout.nodes();
        this._links = this._forceLayout.links();

        this._node = this._vis.selectAll("circle.node");
        this._nodeFunction = this._vis.selectAll("path.node");
        this._link = this._vis.selectAll(".link");

        this._selectionState.node = _.where(this._nodes, {channel_id : 'source'})[0];

        this._redraw(true);

        this.setEmittingState();

        if (hub.source.edges.length) {
          this.addFunctionWidget();
        }

        //when a channel is invalid,
        //arguments: channel id and error message
        this.on('channel:invalid', function(cid, err) {
          var node = this.getParentForCID(cid);
          if (node) {
            node._invalid= true;
            this.showNodeTooltip(node, err);
          }
        });

        this.on('channel:valid', function(cid) {
          var node = this.getParentForCID(cid);
          if (node) {
            node._invalid = false;
            this.hideNodeTooltip(node);
          }
        });
      },

      _setDimensions : function() {
        var $hub = $('#hub'),
          width, height;

        //debugger;

        //$hub.height($(window).height() - 200);
        $('#hub').height($(window).height() - $('#hub').position().top - 60)


        width = $hub.width(),
        height = $hub.height();

        this._layoutConfig.width = width;
        this._layoutConfig.height = height;

        if (this._svg) {
          this._svg.attr('width', width );
          this._svg.attr('height', height );

          this._redraw();
        }

        return [ width, height ];
      },

      shutdown : function() {

        clearInterval(this._pulseIntvl);

        this.undelegateEvents();

        this.$el.removeData().unbind();

        this.$el.remove();

        // Remove view from DOM
        this.remove();
        Backbone.View.prototype.remove.call(this);
      },

      _enumerateActionPointer : function(cid) {
        var nodeNames = _.pluck(this._nodes, 'channel_id'),
          enumMax = 0,
          thisEnum;

        if (!BipClient.isUUID(cid)) {
          for (var i = 0; i < nodeNames.length; i++) {
            thisEnum = Number(nodeNames[i].split('.').pop().replace('_', ''));
            if (!isNaN(thisEnum) && thisEnum >= enumMax) {
              enumMax = thisEnum + 1;
            }
          }

          cid = cid + '._' + enumMax;
        }

        return cid;
      },

      addChannel : function(cid, x, y) {

        cid = this._enumerateActionPointer(cid);

        if ( (!x || !y) && this._selectionState.node) {
          x = this._selectionState.node.x + 40;
          y = this._selectionState.node.y + 40;
        }


        // add node
        var node = {
            channel_id : cid,
            fill : BipClient.find.channel(cid).getIcon(),
            x: x,
            y: y,
            _tooltip: null,
            _dirty : true,
            _invalid: false,
            _parent : null, // where dragging from
            _new : true, // node manually created
            _bipSource : this._bipSource
          },
          self = this;

//        this._bindChannelIcon(node);

        this._nodes.push(node);

        var oldSelectionState = this._selectionState.node;

        this._selectionState.node = node;

        this._setSelectedNodeParams(cid, true);

        this._selectionState.node = oldSelectionState;

        self._redraw();

        this.renderTooltip(node);
        this.refocus();

      },

      //Create tooltip element
      renderTooltip: function(node, err) {
    	  node._tooltip = d3.select(this.el)
    	  .append("div")
    	  .attr("id", "hub-tooltip-" + node.channel_id)
    	  .attr("class", 'hub-tooltip')
    	  .style("position", "absolute")
    	  .style("z-index", "10")
  	  	  .style("opacity", .90);


        //if (err) {
          node._tooltip.attr('class', 'hub-tooltip alert alert-danger');
          node._tooltip.style('display', 'block');
        //}
      },

      hideNodeTooltip: function(node) {
        if(node._tooltip){
          node._tooltip
          .style("z-index", -1)
          .style("opacity", 0); //Make tooltip invisible
        }
      },

      showNodeTooltip: function(node, err) {
        var self = this;
        if(!node._tooltip){
          this.renderTooltip(node, err);
        }
        if(err) {
          var tokens = err.split(':');

          //var nodeClass = node.attr('class');
          //node.attr('class', nodeClass + ' node_invalid');

          node._tooltip.html(
            '<i class="icon-exclamation-sign"></i>'
          );

          node._tooltip
            .style("top", ((parseInt(node.py) - 32) + "px"))
            .style("left", ((parseInt(node.px) - 8) + "px"))
            .style("z-index", "10")
            .style("opacity", .90);

          setTimeout(function() {
            self.hideNodeTooltip(node);
          }, 3000);

          this._redraw();
        }
      },

      refocus : function() {
        $('#hub-focus').focus();
      },

      getParentForCID : function(cid) {
        var filter = {};
        if ('source' === cid) {
          filter.source = true;
        } else {
          filter.channel_id = cid;
        }

        return _.findWhere(this._nodes, filter);
      },

      getParentsForCID : function(cid) {
        var node;

        var parentCIDs = [],
          pcid = cid;

        while (pcid && 'source' !== pcid) {
          node = this.getParentForCID(pcid);
          //pcid = node.source ? 'source' : node._parent;
          pcid = node._parent;
          if (pcid) {
            pcid = pcid.channel_id;
            parentCIDs.push(pcid);
          }
        }

        return parentCIDs;
      },

      linkNodes : function(fromNode, toNode) {
        var link,
          self = this,
          targetDegree = this._nodeDegree(toNode);

        if (targetDegree.in === 0 && toNode && !toNode.source) {
          link = {
            source: fromNode,
            target: toNode
          };

          toNode._parent = fromNode;

          self._links.push(link);

          // select new link
          self._selectionState.link = null;
          self._selectionState.node = toNode;

          link.target._dirty = false;

          return false;

        } else if (fromNode && toNode && fromNode.channel_id !== toNode.channel_id) {
            self._selectionState.link = null;
            self._selectionState.node = null;
            self._drag_line.attr("class", "drag_line_hidden")
            self._clearMouseState();
            return 'Cannot Link Backwards';

//            return 'Drag From A Message Source To A Destination';
//          return 'No Loops Allowed';
        }
      },

      _redrawEnded : true,

      _getChannelId : function(node){
    	  var type = node._bipSource.get('type'),cid;
          if (node.channel_id === 'source') {
              if ('trigger' === type ) {
                cid = node._bipSource.get('config').channel_id
                if (!cid) {
                  cid = 'trigger';
                }
              } else {
            	if(node._bipSource.get('config').channel_id) {
            		cid = node._bipSource.get('config').channel_id;
            	} else {
            		cid = type;
            	}
              }
         } else {
           cid = node.channel_id;
         }
          return cid;
      },

      // redraw force layout
      _redraw : function(cooldown) {
        var self = this;

        this._redrawEnded = false;

        // LINK RENDER
        this._link = this._link.data(this._links,
          function(d) {
            return d.source.channel_id + "-" + d.target.channel_id;
          }
        );

        this._link
          .enter()
          .insert("line", ".node")
          .style("marker-end" ,function(d){
          		return 'url("#end-arrow")';
          })
          .attr("class", "link")
          .attr("class", "link-fat")
          .on("mousedown", function(d) {
            self._mouseState.downLink = d;
            if (self._mouseState.downLink == self._selectionState.link) {
              self._selectionState.link = null;
            } else {
              self._selectionState.link = self._mouseState.downLink;
              self.refocus();
            }
            self._selectionState.node = null;

            self._redraw();
          })
          .on("mouseover", function(node) {
              // 0.1 is a workable alpha/cooldown threshhold
              // from which after we should handle hover events
              if (self._forceLayout.alpha() < 0.1) {
              	var sourceCId = self._getChannelId(node.source),
              	targetCId = self._getChannelId(node.target);

                _.debounce(
                  function() {
                    self.trigger('edge:hover', sourceCId , targetCId);
                  },
                  100,
                  true
                )();

              }
          })
          .on("mouseout", function(node) {
            // 0.1 is a workable alpha/cooldown threshhold
            // from which after we should handle hover events
            if (self._forceLayout.alpha() < 0.1) {
               self.trigger('edge:dehover');
            }
          });

        this._link.exit().remove();

        this._link.classed("link_selected", function(d) {
          return d === self._selectionState.link;
        });

        this._link.style("marker-end" ,function(d){
      	  if(d === self._selectionState.link)
      	    return 'url(#end-arrow-selected)';
      	  else
      	    return 'url("#end-arrow")';
      	});

        var nodeCircle = [];
        var nodeR = [];

        for(var i = 0 ; i < this._nodes.length; i++){
        	if(BipClient.isFunctionPod(this._nodes[i].action)){
        		nodeR.push(this._nodes[i]);
        	} else {
        		nodeCircle.push(this._nodes[i]);
        	}
        }

        // NODE RENDER
        this._node = this._node.data(nodeCircle, function(d) {
          return d.channel_id
        });

        this._nodeFunction = this._nodeFunction.data(nodeR, function(d) {
          return d.channel_id
        });

        var touchTime = 0;

        this.selection = function(selection, type) {
          $(selection).unbind();

          var data = selection.map(function(d) {
            return (d[0] && d[0].__data__) ? d[0].__data__ : {};
          })[0];

          var group = selection.insert('g'),
            channel = BipClient.getCollection('channel').get(data.channel_id),
            dom;

          group.append('svg:image')
            .attr('xlink:href', function(d) {
              return d.fill;
            })
            .attr('width', function(d) {
              return BipClient.isFunctionPod(d.action) ? 36 : (self._radius * 2) - 13;
            })
            .attr('height', function(d) {
              return BipClient.isFunctionPod(d.action) ? 36 : (self._radius * 2) - 13;
            })
            .attr('x', 0)
            .attr('y', 0);


          dom = group.insert(type).attr("r", this._radius);

        	group.attr("class", function(d) {
           		 var nodeClass = 'node';
          		  if ('source' === d.channel_id) {
             		 d.source = true;
             		 nodeClass += ' node_source';
             		 if(d.label === 'Event Source')
            	  		nodeClass += ' node_init';
            	  }
            	return nodeClass;
          	})
            .attr('data-cid', function(d) {
              return d.channel_id;
            })

          	.on("click", function(d) {
            	if (d.channel_id === 'source' && d.label === 'Event Source') {
            		self.trigger('loadPods');
            	} else if (self._mouseState.downNode == self._selectionState.node) {
                self._selectionState.node = null;
              }
          })
		  // Double click on channel, transforms modal
          .on("dblclick", function(d) {
            if (d._dirty) {
              BipClient.growl('This Action Needs A Connection First!', 'warning');
              return;
            }

            self._mouseState.downNode = d;
            self._selectionState.node = self._mouseState.downNode;

            // kill drag line
            self._drag_line.attr("class", "drag_line_hidden")

            self._redraw();

            // modal needs to launch after _redraw, otherwise
            // the simulation will render off the canvas
            self._initModal(d.channel_id, 'transforms');

          })
          .on('touchstart', function(d) {
            var nowTime = d3.event.timeStamp;

            if (nowTime - touchTime < 500) {
              var e = document.createEvent('UIEvents');
              e.initUIEvent('dblclick', true, true);
              d3.event.srcElement.dispatchEvent(e)
              touchTime = 0;
            }

            var e = document.createEvent('UIEvents');
            e.initUIEvent('mousedown', true, true);
            d3.event.srcElement.dispatchEvent(e)

            touchTime = nowTime;
          })
          /*
          .on('touchend', function(d) {
            var e = document.createEvent('UIEvents');
            e.initUIEvent('mouseup', true, true);
            d3.event.srcElement.dispatchEvent(e)
          })
*/
          .on("mousedown",
            function(d) {
              if (self._nodes.length > 1) {
                if (d3.event.shiftKey && self._selectionState.node && d !== self._selectionState.node) {
                  var err = self.linkNodes(self._selectionState.node, d);

                  if ('reversal' === err) {
                    self._addEdge(d._parent);
                    self._selectionState.node = d;
                  } else {
                    if (err) {
                      BipClient.growl(err, 'error');
                    } else {
                      self._addEdge(d);
                      self._selectionState.node = d._parent;
                    }
                  }
                } else {
                  self._mouseState.downNode = d;
                  // deselect (@todo - go in click handler)
                  if (false && self._mouseState.downNode == self._selectionState.node) {
                    self._selectionState.node = null;
                  } else {
                    // select
                    self._selectionState.node = self._mouseState.downNode;
                    self.refocus();
                  }

                  // deselect link
                  self._selectionState.link = null;

                  // reposition drag line
                  self._drag_line
                  .attr("class", "link")
                  .attr("x1", self._mouseState.downNode.px)
                  .attr("y1", self._mouseState.downNode.py)
                  .attr("x2", self._mouseState.downNode.px)
                  .attr("y2", self._mouseState.downNode.py);
                }

                self._redraw();
              }
            })
          .on('contextmenu', function(d) {
            // do nothing
          })
          .on('mousedrag', function(d) {
            self._redraw();
          })
          // detect loop and create new link + node if none
          .on('mouseup',
            function(d) {
              if (self._mouseState.downNode) {
                self._mouseState.upNode = d;
                if (self._mouseState.upNode == self._mouseState.downNode) {
                  self._drag_line.attr("class", "drag_line_hidden");
                  self._clearMouseState();
                  return;
                }

                self._clearCollision();

                var err = self.linkNodes(self._mouseState.downNode, self._mouseState.upNode);

                if (err && 'reversal' !== err) {
                  BipClient.growl(err, 'error');
                  self._selectionState.link = null;
                  self._selectionState.node = null;
                  self._drag_line.attr("class", "drag_line_hidden")
                  self._clearMouseState();
                }

                self._redraw();
              }
            })
          .on("mouseover", function(node) {
            var type = node._bipSource.get('type'),
              cid;

            // 0.1 is a workable alpha/cooldown threshhold
            // from which after we should handle hover events
            if (self._forceLayout.alpha() < 0.1) {
              if(node._tooltip && node._invalid == true){
                self.showNodeTooltip(node);
              }

              if (node.channel_id === 'source') {

                if ('trigger' === type ) {
                  cid = node._bipSource.get('config').channel_id
                  if (!cid) {
                    cid = 'trigger';
                  }
                } else {
                	if(node._bipSource.get('config').channel_id) {
                		cid = node._bipSource.get('config').channel_id;
                	} else {
                		cid = type;
                	}
                }
              } else {
                cid = node.channel_id;
              }

              _.debounce(
                function() {
                  self.trigger('channel:hover', cid, node._parent);
                },
                100,
                true
              )();

            }
          })
          .on("mouseout", function(node) {
            // 0.1 is a workable alpha/cooldown threshhold
            // from which after we should handle hover events
            if (self._forceLayout.alpha() < 0.1) {
              if(node._tooltip){
                self.hideNodeTooltip(node);
              }
              _.debounce(
                function() {
                  self.trigger('channel:dehover');
                },
                100,
                true
              )();
            }
          })
          .transition()
          .duration(50)
          .ease('linear');
        }

        this.selection(this._node.enter() ,'circle');
        this.selection(this._nodeFunction.enter(),'path');

        this._node.exit().transition()
          .attr("r", 0)
          .remove();

        this._node.classed("node_selected", function(d) {
          return d === self._selectionState.node;
        });

        this._node.classed("node_orphan", function(d) {
          return d._dirty;
        });

        this._node.classed("node_invalid", function(d) {
            return d._invalid || d.collision_invalid;
        });

        this._node.classed("node_collide", function(d) {
            return d.collision && !d.collision_invalid;
        });

        this._nodeFunction.exit().transition()
          .attr("r", 0)
          .remove();

        this._nodeFunction.classed("node_selected", function(d) {
          return d === self._selectionState.node;
        });

        this._nodeFunction.classed("node_orphan", function(d) {
          return d._dirty;
        });

        this._nodeFunction.classed("node_invalid", function(d) {
            return d._invalid || d.collision_invalid;
        });

        this._nodeFunction.classed("node_collide", function(d) {
          return d.collision && !d.collision_invalid;
        });

        if (d3.event) {
          // prevent browser's default behavior
          d3.event.preventDefault();
        }

  //        this._forceLayout.charge(-1500).linkDistance(100).friction(0.75)
  //        .size([this._layoutConfig.width, this._layoutConfig.height])

        this._forceLayout
          .linkDistance(85)
          .charge(-1400)
          .friction(0.5)
          .chargeDistance(900)
          .alpha(0.05)
          .size([this._layoutConfig.width, this._layoutConfig.height])
          .on('end', function() {
            self._redrawEnded = true;
          });

        this._forceLayout.start();

        if (cooldown) {
          var safety = 0;
          while(this._forceLayout.alpha() > 0) { // You'll want to try out different, "small" values for this
            this._forceLayout.tick();
            if(safety++ > 100) {
              break;// Avoids infinite looping in case this solution was a bad idea
            }
          }
          this._forceLayout.stop();
        }

      },

      // ----------------------------------------------- GRAPH INTERACTION

      selectSource : function() {
        for (var i = 0; i < this._nodes.length; i++) {
          if (this._nodes[i].channel_id == 'source') {
            this._selectionState.node = this._nodes[i];
            break;
          }
        }
      },

      setEmittingState : function() {
        var self = this;

        if (this._pulseIntvl) {
          clearInterval(this._pulseIntvl);
        }

        // setup events
        this._pulseIntvl = setInterval(function() {
          var $start = d3.select('g.node_source circle'),
            cx,
            cy;

          try {
            cx = $start.attr('cx');
            cy = $start.attr('cy');
            d3.select('g > g').insert("circle", "line")
              .attr("class", "ring")
              .attr("cx", cx)
              .attr("cy", cy)
              .attr("r", self._pulseSettings.fromr)
              .style("stroke-width", self._pulseSettings.fromstroke)
              .style("stroke", "#0194a4")
              .style("fill", "white")
            .transition()
              .ease("linear")
              .duration(700)
              .style("stroke-opacity", 0)
              .style("stroke-width", self._pulseSettings.tostroke)
              .style("stroke", "#0194a4")
              .style("fill", "white")
              .attr("r", self._pulseSettings.tor)
              .remove();

          } catch (e) {
            clearInterval(self._pulseIntvl);
          }
        }, 1000);
      },

      addFunctionWidget : function(rebind) {
        if (rebind) {
          $('#function-select2').remove();
          delete this._functionListView;
        }

        if (!this._functionListView) {
          // add functions view
          var functionList = new FunctionsListView('#hub'),
            self = this;

          functionList.render();

          functionList.on('function:selected', function(func) {
            self.addChannel(func);
          })
          .on('select2-close', function() {
            setTimeout(function() {
              self.refocus();
            }, 200);
          });

          this._functionListView = functionList;
        }
      },

      setTriggerSourceParams : function(model) {
        var self = this,
          $svgNodes = $(this._node[0]),
          $node;

        this._bindBipSource(model);
        this.selectSource();

        this._setSelectedNodeParams(model.get('config').channel_id, true);

        // update fill on source node

        for (var i = 0; i < $svgNodes.length; i++) {
          $node = $($svgNodes[i]);

          if ('source' === $node.attr('data-cid')) {
            $node.attr('class', function(index, classNames) {
              return classNames.replace('node_init', '');
            });
            break;
          }
        }

        $('circle.ring').remove();

        var oldPulseSettings = _.clone(this._pulseSettings);
        // set large pulse
        this._pulseSettings = {
          fromr : 18,
          tor : 40,
          fromstroke : 6,
          tostroke : 10
        };

        this.setEmittingState();

        // restore
        setTimeout(function() {
          self._pulseSettings = oldPulseSettings;
        }, 2000);

        this.addFunctionWidget();
      },

      bindBipSourceIcon : function(url) {
        $('g.node_source image').attr('href', url);
      },

      // maintain type and source channel (trigger bip) state for
      // the 'source' node as a means for tracking source transforms
      _bindBipSource : function(newSource) {
        this._bipSource = newSource;
        // find 'source' node and update type + exports
        for (var i = 0; i < this._nodes.length; i++) {
          if (this._nodes[i].source) {
            this._nodes[i]._bipSource = this._bipSource;
            this.bindBipSourceIcon(this._bipSource.getIcon());
            //this._bindChannelIcon(this._nodes[i]);
            break;
          }
        }
      },

      // attaches an edge with transforms to the selected
      // nodees parent
      //
      // @todo - should we bind transform hints now?
      _addEdge : function(targetNode) {
        var ptr,
        template,
        node = targetNode || this._selectionState.node,
        hub = node._bipSource.get('hub'),
        parent = node._parent,
        pcid;

        pcid = parent._parent ? parent.channel_id : 'source';

        if (!hub[pcid]) {
          hub[pcid] = {};
        }

        if (!hub[pcid].edges) {
          hub[pcid].edges = [];
        }

        ptr = hub[pcid];

        if ($.inArray(node.channel_id, ptr.edges) < 0) {
          ptr.edges.push(node.channel_id);
        }

        if (!ptr.transforms || ( node.channel_id && !ptr.transforms[node.channel_id])) {
          this.trigger('transform:hint', node.channel_id, pcid, 'source' === pcid);
        }

        if (this._activeModal) {
          this._activeModal.modal('hide');
        }

        this.trigger('channel:dehover');

      },

      _removeSelectedNode : function() {
        var bip, n;

        // can't delete source nodes
        if (this._selectionState.node && !this._selectionState.node.source) {

          // drop from hub
          n = this._selectionState.node;
//          bip = n._bipSource;
//          if (n._parent) {
//            bip.removeEdge(n._parent.channel_id, n.channel_id, n._parent.source);
//          }

          this.trigger('channel:remove', n.channel_id);
          this.trigger('channel:dehover');

          // drop parent binding from dependent children
          var children = _.filter(this._nodes, function(node) {
            return node._parent && node._parent.channel_id === n.channel_id;
          });

          for (var i = 0; i < children.length; i++) {
            children[i]._parent = null;
          }

          // mark children as dirty
          _.each(
            this._links,
            function(link) {
              if (link.source === n) {
                link.target._dirty = true
              }
            }
            );

          this._selectionState.node = null;
          this._nodes.splice(this._nodes.indexOf(n), 1);
          this._spliceNodeLinks(n);
          this._currentExports = null;
          n._parent = null;
        }
      },

      _spliceNodeLinks : function(node) {
        var self = this,
        toSplice = this._links.filter(
          function(linkNode) {
            return (linkNode.source === node) || (linkNode.target === node);
          });

        toSplice.map(
          function(node) {
            self._links.splice(self._links.indexOf(node), 1);
          });
      },

      /**
       * Updates the selected node with the given channel id's
       * parameters
       */
      _setSelectedNodeParams : function(cid, ignoreSelection) {
        if (this._selectionState.node) {
          if (cid) {
            if (!this._selectionState.node.oldChannelId && this._selectionState.node.channel_id) {
              this._selectionState.node.oldChannelId = this._selectionState.node.channel_id;
            }

            var channel = BipClient.getCollection('channel').get(cid);

            this._selectionState.node.channel_id = cid;
            this._selectionState.node.label = channel.get('name');

            this._selectionState.node.fill = this._selectionState.node.fill ? this._selectionState.node.fill : 'image_' + channel.get('action').split('.')[0];
            this._selectionState.node.gone = false;
            this._selectionState.node.action = channel.get('action');

            // update svg
//            if (!ignoreSelection) {
//              $('.node_selected').attr('fill', 'url(#' + this._selectionState.node.fill + ')');
//            }

          } else {
            this._selectionState.node.channel_id = null;
            this._selectionState.node.fill = '';
            this._selectionState.node.gone = true;
          }
        }
      },

      channelReplace : function(from, to) {
        _.each(this._nodes, function(node) {
          if (node.channel_id === from) {
            node.channel_id = to;
          }
        });
      },

      /**
        * @param string cid Channel ID
        */
      _getNodeStruct : function(cid) {
        // don't break hubs where channels have been deleted
        // use the existence of a 'gone' edge to deny saving
        // the hub until resolved.
        var x = this._layoutConfig.width / 2,
          y = this._layoutConfig.height / 2,
          nStruct = {
            channel_id : cid,
            gone : false,
            fill : '',
            weight : 2,
            transforms : {}
          },
          fill,
          triggerId,
          bip = this._bipSource,
          config = bip.get('config'),
          channel = BipClient.getChannel(cid);

        if ('source' === cid) {

          fill = bip.getIcon();

          nStruct = {
            channel_id : 'source',
            label : this._bipSource.get('name') || this._bipSource.get('_repr'),
            gone : false,
            fill : fill,
            action : this._bipSource.get('action'),
            x : x,
            y : y,
            cx : x,
            cy : y
          };

        } else {
          if (channel) {
            nStruct.action = channel.get('action');
            nStruct.label = channel.get('name');
            nStruct.fill = channel.getIcon();
          } else {
            nStruct.gone = true;
            nStruct.label = 'GONE!';
          }
        }

        nStruct._bipSource = this._bipSource;

        return nStruct;
      },

      _hub2D3 : function(hub) {
        var cid,
        links = [],
        nodes = [],
        // maintain hash list of channel indices, these get fed
        // into links
        linkMap = {};

        // feed links forward
        for (var edge in hub) {

          if (!linkMap[edge]) {
            linkMap[edge] = this._getNodeStruct(edge, this._actions);
          }

          for (var i = 0; i < hub[edge].edges.length; i++) {
            cid = hub[edge].edges[i];

            if (!linkMap[cid]) {
              linkMap[cid] = this._getNodeStruct(cid, this._actions);
            }

            links.push({
              source : linkMap[edge],
              target : linkMap[cid],
              weight : 2
            });
          }
        }

        // bind parents
        for (var i = 0; i < links.length; i++) {
          links[i].target._parent = links[i].source;
        }

        // no duplicate channel id's allowed
        for (var idx in linkMap) {
          nodes.push(linkMap[idx]);
        }

        return {
          nodes : nodes,
          links : links
        }
      },

      _pathDeltas : function(d) {
        var deltaX = d.target.x - d.source.x,
          deltaY = d.target.y - d.source.y,
          dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        return {
          normX : deltaX / dist,
          normY : deltaY / dist
        }
      },

      _angleRad : function(d, rev) {
        if (rev) {
          return Math.atan2(d.source.y - d.target.y, d.source.x - d.target.x) ;
        } else {
          return Math.atan2(d.target.y - d.source.y, d.target.x - d.source.x);
        }
      },

      // get the in and out degrees for a node
      _nodeDegree : function(node) {
        var self = this,
          inDegree = 0,
          outDegree = 0;

        for (var i = 0; i < self._links.length; i++) {
          link = self._links[i];
          if (link.target === node) {
            inDegree++;
            break;
          } else if (link.source === node) {
            outDegree++;
          }
        }
        return { in : inDegree, out : outDegree };
      },

      // find node nearest to a point
      _pointCollision : function(x, y) {
        // capture radius
        var self = this,
          captureRadius = this._radius * 1.5,
          shortestDistance,
          closestNode;

        this._clearCollision();

        _.each(this._nodes, function(node) {
          var dx = x - node.x,
            dy = y - node.y,
            distance = Math.sqrt(
              dx * dx + dy * dy
            );

          if (node !== self._mouseState.downNode && (distance < captureRadius + self._radius) ) {
            if (undefined === shortestDistance || distance < shortestDistance) {
              // check in degree & out degree of node
              //if (!self._nodeDegree(node).in) {
                shortestDistance = distance;
                if (closestNode) {
                  closestNode.collision = false;
                }

                closestNode = node;
                closestNode.collision = true;
                closestNode.collision_invalid = !!self._nodeDegree(node).in;
              //}
            }
          }
        });

        return closestNode;
      },

      _clearCollision : function() {
        _.each(
          this._nodes,
          function(node) {
            delete node.collision;
            delete node.collision_invalid;
          }
        );
      },

      // tests bounding box constraints
      _testBounds : function(x, y) {
        if (x < this._boundingBox.left) {
          x = this._boundingBox.left;
        } else if (x > (this._layoutConfig.width - this._boundingBox.right) ) {
          x = this._layoutConfig.width - this._boundingBox.right;
        }

        if (y < this._boundingBox.top) {
          y = this._boundingBox.top;
        } else if (y > (this._layoutConfig.height - this._boundingBox.bottom)) {
          y = this._layoutConfig.height - this._boundingBox.bottom;
        }

        return [ x, y ];

      },

      _tick : function() {
        var self = this;
        var r = this._radius;

        //

        this._node.select('circle').attr("cx", function(d) {
          return Math.max(
            r,
            Math.min(
              self._layoutConfig.width - r,
              self._testBounds(d.x, d.y)[0]
            )
          );
        })
        .attr("cy", function(d) {
          return Math.max(
            r,
            Math.min(
              self._layoutConfig.height - r,
              self._testBounds(d.x, d.y)[1]
            )
          );
        });

        this._node.select('image').attr("x", function(d) {
          return Math.max(r, Math.min(self._layoutConfig.width - r, d.x)) - self._radius + 7;
        })
        .attr("y", function(d) {
          return Math.max(r, Math.min(self._layoutConfig.height - r, d.y)) - self._radius + 7;
        });


        var lineFunction  =  d3.svg.line()
          .x(function(d) {
            return d[0];
          })
          .y(function(d) {
            return d[1];
          })
          .interpolate("linear");

        this._nodeFunction.select('path').attr("x", function(d) {
           return Math.max(
            r,
            Math.min(
              self._layoutConfig.width - r,
              self._testBounds(d.x, d.y)[0]
            )
          );
        })
        .attr("y", function(d) {
          return Math.max(
            r,
            Math.min(
              self._layoutConfig.height - r,
              self._testBounds(d.x, d.y)[1]
            )
          );
        })
          .attr("d", function(d)
          {
              var _s32 = (Math.sqrt(3) / 2);
              var A = Math.floor(self._radius * 0.7);
              var xDiff = Math.ceil(Math.max(r, Math.min(self._layoutConfig.width - r, d.x)));
              var yDiff =  Math.ceil(Math.max(r, Math.min(self._layoutConfig.height - r, d.y)));
              var pointData =
                [
                  [ A + xDiff, _s32 + yDiff],
                  [ A/2 + xDiff, A * _s32 + yDiff],
                  [ -A/2 + xDiff, A * _s32 + yDiff],
                  [ -A + xDiff, 0 + yDiff],
                  [ -A/2 + xDiff, -A * _s32 + yDiff],
                  [ A/2 + xDiff, -A * _s32 + yDiff] ,
                  [ A + xDiff, _s32 + yDiff]
                ];

            return lineFunction(pointData)

          });

        this._nodeFunction.select('image').attr("x", function(d) {
         return Math.max(r, Math.min(self._layoutConfig.width - r, d.x)) - 18;
        })
        .attr("y", function(d) {
          return Math.max(r, Math.min(self._layoutConfig.height - r, d.y)) - 18;
        });


        if (this._node._tooltip) {
          this._node._tooltip
              .style("top", ((parseInt(node.py) - 32) + "px"))
              .style("left", ((parseInt(node.px) - 8) + "px"));
        }

        // slow, must be a better way?
        this._link.attr("x1", function(d) {
          var radians = self._angleRad(d),
            offs = BipClient.isFunctionPod(d.source.action) ? 7 : 2;

          // negative offset source x for hexagonal clip
          return Math.cos(radians) * (r - offs) + d.source.x;
        })
        .attr("y1", function(d) {
          var radians = self._angleRad(d),
            offs = BipClient.isFunctionPod(d.source.action) ? 7 : 2;

          // negative offset source y for hexagonal clip
          return Math.sin(radians) * (r - offs) + d.source.y;
        })
        .attr("x2", function(d) {
          var radians = self._angleRad(d, true);
          return Math.cos(radians) * (r + 7) + d.target.x;
        })
        .attr("y2", function(d) {
          var radians = self._angleRad(d, true);
          return Math.sin(radians) * (r + 7) + d.target.y;
        });

      },


      // ---------------------------------- CHANNEL SELECT+TRANSFORM MODAL

      // initializes adjacent exports for the selected node
      _initModal : function(cid, type) {
        // sets current exports

        var parentSource = !this._selectionState.node._parent || !this._selectionState.node._parent._parent,
          isTrigger = ('trigger' === this._bipSource.get('type'));

        if (type === 'transforms') {
          if(this._selectionState.node._parent) {
            this.trigger('transform:cid', cid, this._selectionState.node._parent.channel_id, parentSource);

          } else if (this._selectionState.node._bipSource.get('config').channel_id) {
            cid = this._selectionState.node._bipSource.get('config').channel_id;
            this.trigger('trigger:configure', cid);
          }
        } else {
          this.trigger('select:cid', cid, this._selectionState.node._parent.channel_id, parentSource);
        }
      },

      _modalEvTimer : null,

      _getSelection : function() {
        var savedRange;
        if(window.getSelection && window.getSelection().rangeCount > 0) //FF,Chrome,Opera,Safari,IE9+
        {
          savedRange = window.getSelection().getRangeAt(0).cloneRange();
        }
        else if(document.selection)//IE 8 and lower
        {
          savedRange = document.selection.createRange();
        }
        return savedRange;
      },

      _updateFocus : function(target) {
        var range = document.createRange();
        var sel = window.getSelection();
        range.setStart(target, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      },

      // recursively tries to find a valid parent with exports
      _getValidExportParent : function(node) {
        var p = node._parent;
        if (p && p._hasExports || p === p._bipSource) {
          return p;
        } else {
          return this._getValidExportParent(node._parent);
        }
      },

      _getExports : function() {
        return this._currentExports;
      },

      // -------------------------------------------------- MOUSE&KEYBOARD
      _mouseCtl : function(type) {
        var self = this,
        state = this._mouseState;

        if (type == 'move' || type == 'touchmove') {
          return function() {
            if (!state.downNode) return;

            // update drag line
            self._drag_line
            .attr("x1", state.downNode.x)
            .attr("y1", state.downNode.y)
            .attr("x2", d3.mouse(this)[0])
            .attr("y2", d3.mouse(this)[1]);

            self._pointCollision(
              d3.mouse(this)[0],
              d3.mouse(this)[1]
            );

            self._redraw()

            return false;
          }
        } else if (type == 'up' || type == 'touchend') {
          return function() {
            var modalLaunch = false;

            // hide drag line
            self._drag_line.attr("class", "drag_line_hidden")

            if (state.downNode) {

              // adding nodes from drag out deprecated
              /*
              if (!state.upNode) {
                // add node
                var point = d3.mouse(this),
                node = {
                  x: point[0],
                  y: point[1],
                  _parent : state.downNode, // where dragging from
                  _new : true, // node manually created
                  _bipSource : self._bipSource

                },
                n = self._nodes.push(node);

                // select new node
                self._selectionState.node = node;
                self._selectionState.link = null;

                // add link to mousedown node
                self._links.push({
                  source: state.downNode,
                  target: node
                });

                modalLaunch = true;
              }
              */

              if (!state.upNode) {
                state.upNode = self._pointCollision(
                  d3.mouse(this)[0],
                  d3.mouse(this)[1]
                );

                // if an error linking nodes, then ignore
                // @todo should fall back to nearest linkable node
                var err = self.linkNodes(state.downNode, state.upNode)
                if (err) {
                  state.upNode = null;
                  BipClient.growl(err, 'error');
                }

              }

              if (state.upNode) {
                // attach upNode's parent to source
                // select new node

                self._selectionState.node = state.upNode;

                state.upNode._parent = state.downNode;
                self._addEdge();

                // on connected, start transform
                // self._initModal(state.upNode.channel_id, 'transforms');
                self.trigger('channel:dehover');
              }

              // clear collision state
              self._clearCollision();

              // re-render
              self._redraw();

              // modal needs to launch after _redraw, otherwise
              // the simulation will render off the canvas
              if (modalLaunch) {
                self._initModal();
              }
            }
            // clear mouse event vars
            self._clearMouseState();
          }
        } else if (type == 'down' || type == 'touchstart') {
          return function() {
            // stub, do nothing
          }
        }
      },

      _keyCtl : function() {
        var self = this;

        if (!this._selectionState.node && !this._selectionState.link) {
          return;
        }

        if (d3.event.target.id === 'hub-focus') {
          switch (d3.event.keyCode) {
            case 8: // backspace
            case 46: { // delete
              if (this._selectionState.node) {
                this._removeSelectedNode();
              } else if (this._selectionState.link) {

                var l = this._selectionState.link;

                // notify channel drop
                self.trigger('channel:remove', l.target.channel_id);
                self.trigger('channel:dehover');

                // clear hub link state state
                this._selectionState.link.target._parent = null;
                this._selectionState.link.target._dirty = true;
                this._links.splice(this._links.indexOf(this._selectionState.link), 1);
              }

              this._selectionState.link = null;
              this._selectionState.node = null;
              this._redraw();
              break;
            }
            // ctrl+i opens the functions list for [i]nserts
            case 73 : {
              if (d3.event.ctrlKey) {
                self._functionListView.openSelect();
                return false;
              }
              break;
            }
          }

          // propogate key event to any view listeners
          self.trigger('keyEvent', d3.event);
        }
      },

      _clearMouseState : function() {
        this._mouseState.upNode =
        this._mouseState.downNode =
        this._mouseState.upLink =
        this._mouseState.downLink = null;
      }
    });

    return HubView;
  });
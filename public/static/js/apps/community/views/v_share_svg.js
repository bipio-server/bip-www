// particles https://github.com/VincentGarreau/particles.js

require.config({
  baseUrl : "/static/js",

  paths: {
    jquery: 'vendor/jquery/jquery-min',
    underscore: 'vendor/underscore/underscore-1.8.1',
    backbone : 'vendor/backbone/backbone-min',
    'd3' : 'vendor/d3/d3.min',
  },
  shim : {
    'bootstrap': [ 'jquery' ],
    "jquery_b64" : {
      deps : [ "jquery" ]
    }
  }
});

define([
  'd3',
  'underscore',
  'backbone',
  ], function(d3, _, Backbone){
    HubView = Backbone.View.extend({

      _bipSource : null, // source bip type

      _radius : 17,

      _arrowLength : 7,

      _layoutConfig : {
        width : 400,
        height : 400
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

      _drag_line : null, // line drag vis when attaching new channels

      initialize:function (bipSource, el, layoutConfig) {
        var self = this;

        this.el = el;
        this.$el = $(el)

        _.bindAll(this,
          'render',
          'shutdown',

          '_redraw',
          '_tick',
          '_getNodeStruct',

          'setEmittingState'
        );

        this._bipSource = bipSource;

        if (layoutConfig) {
          this._layoutConfig = layoutConfig;
        }

        var fill = d3.scale.category20();

        // init svg
        this._svg = d3.select(this.el)
        .append("svg:svg")
        .attr("width", this._layoutConfig.width)
        .attr("height", this._layoutConfig.height)
        .attr("pointer-events", "none");

        // bip 'source' always available
        if (bipSource.manifest.indexOf('bipio') === -1) {
          bipSource.manifest.push('bipio');
        }

        var pod;

        // setup channel fill definitions for available pods
        for (var i = 0; i < bipSource.manifest.length; i++) {
          var defs = this._svg.append('svg:defs'),
            pattern = bipSource.manifest[i].replace('.', '_'),
            pod = this._getPod(bipSource.manifest[i]),
            linkBase = '/static/img/channels/32/color/',
            link;

          if ('flow' === pod) {
            linkBase += '/flow/' + pattern.split('_')[1];
          } else if ('bipio' !== pod) {
            pattern = pod;
            linkBase += pattern;
          }

          if ('bipio' === pod) {
            linkBase += '/bip_' + bipSource.type;
          }

          linkBase += '.png';

          defs.append('svg:defs')
          .append('svg:pattern')
            .attr('id', 'image_' + pattern )
            .attr('patternUnits', 'objectBoundingBox')
            .attr('height', this._radius * 2)
            .attr('width', this._radius * 2)
          .append('svg:image')
            .attr('xlink:href', linkBase)
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this._radius * 2)
            .attr('height', this._radius * 2);
        }

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

        this._vis = this._svg
        .append('svg:g')
        .on("dblclick.zoom", null)
        .append('svg:g');

        this._vis.append('svg:rect')
        .attr('width', this._layoutConfig.width)
        .attr('height', this._layoutConfig.height)
        .attr('fill', 'transparent');

      },

      _pulseSettings : {
        fromr : 16,
        tor : 32,
        fromstroke : 3,
        tostroke : 1
      },

      render : function(hub) {
        // convert hub to a d3 graph struct
        var struct = this._hub2D3(hub),
          self = this;

        this._forceLayout = d3.layout.force()
          .nodes(struct.nodes)
          .links(struct.links)
          .size([this._layoutConfig.width, this._layoutConfig.height])
          .on("tick", this._tick);

        // get layout properties
        this._nodes = this._forceLayout.nodes();
        this._links = this._forceLayout.links();

        this._node = this._vis.selectAll(".node_nofill");
        this._link = this._vis.selectAll(".link");

        this._redraw();

        if (hub.source.edges.length) {
          this.setEmittingState();
        }
        setTimeout(function() {
          self.$el.removeClass('out').addClass('in');
        }, 300)

      },

      shutdown : function() {
        clearInterval(this._pulseIntvl);
      },

      _bindChannelIcon : function(node) {
        var cid = node.channel_id;

        if (cid) {

          if ('source' === cid && 'trigger' === this._bipSource.type) {
            cid = this._bipSource.config.channel_id;
          } else if ('source' === cid) {
            return;
          }

          if (cid) {
            //var iconURL = BipClient.getCollection('channel').get(cid).getIcon();
            //cid = this._getPod(cid);
            iconURL = null;
            if (iconURL && !d3.select('#icon-' + cid)[0][0]) {
              var defs = d3.select('svg'),
                patternID = 'icon-' + cid;

              node.fill = patternID;

              defs.append('svg:defs')
                .append('svg:pattern')
                  .attr('id',  patternID )
                  .attr('patternUnits', 'objectBoundingBox')
                  .attr('height', this._radius * 2)
                  .attr('width', this._radius * 2)
                .append('svg:image')
                  .attr('xlink:href', iconURL )
                  .attr('x', 0)
                  .attr('y', 0)
                  .attr('width', this._radius * 2)
                  .attr('height', this._radius * 2);
            }
          }
        }
      },

      // redraw force layout
      _redraw : function(debug) {
        var self = this;

        // LINK RENDER
        this._link = this._link.data(this._links,
          function(d) {
            return d.source.channel_id + "-" + d.target.channel_id;
          }
        );

        this._link
        .enter()
        .insert("line", ".node_nofill")
        .style('marker-end', function(d) {
          return 'url(#end-arrow)'
        })
        .attr("class", "link")
        .attr("class", "link-fat");

        this._link.exit().remove();

        // NODE RENDER
        this._node = this._node.data(this._nodes, function(d) {
          return d.channel_id
        });

        this._node
          .enter()
          .insert("circle")
          .attr("class", function(d) {
            var nodeClass = 'node_nofill';
            if ('source' === d.channel_id) {
              d.source = true;
              nodeClass += ' node_source';
            }
            return nodeClass;
          })
          .attr('fill', function(d) {
            return 'url(#' + d.fill + ')';
          })
          .attr("r", 40)
          .transition()
          .duration(50)
          .ease('linear')
          .attr("r", this._radius);

        this._node.exit().transition()
          .attr("r", 0)
          .remove();

        if (d3.event) {
          // prevent browser's default behavior
          d3.event.preventDefault();
        }

        this._forceLayout
          .linkDistance(80)
          .linkStrength(0.9)
          .charge(-1300)
          .friction(0.75)
          .chargeDistance(900)
          .theta(0.7)
          .alpha(0.1)
          .gravity(0.25)
          .size([this._layoutConfig.width, this._layoutConfig.height]);

        this._forceLayout.start();

        var safety = 0;;
        while(this._forceLayout.alpha() > 0) { // You'll want to try out different, "small" values for this
          this._forceLayout.tick();
          if(safety++ > 30) {
            break;// Avoids infinite looping in case this solution was a bad idea
          }
        }
      },

      // ----------------------------------------------- GRAPH INTERACTION

      setEmittingState : function() {
        var self = this;
        // setup events
        this._pulseIntvl = setInterval(function() {
          var $start = d3.select(self.el + ' circle.node_source'),
            cx,
            cy;

          try {
            cx = $start.attr('cx');
            cy = $start.attr('cy');
            d3.select(self.el + ' g > g').insert("circle", "line")
              .attr("class", "ring")
              .attr("cx", cx)
              .attr("cy", cy)
              .attr("r", self._pulseSettings.fromr)
              .style("stroke-width", self._pulseSettings.fromstroke)
              .style("stroke", "#0194a4")
              .style("fill", "transparent")
            .transition()
              .ease("linear")
              .duration(700)
              .style("stroke-opacity", 0)
              .style("stroke-width", self._pulseSettings.tostroke)
              .style("stroke", "#0194a4")
              .style("fill", "transparent")
              .attr("r", self._pulseSettings.tor)
              .remove();

          } catch (e) {
            clearInterval(self._pulseIntvl);
          }
        }, 1000);
      },

      _getPod : function(ptr) {
return ptr.split('.')[0];
//        return ptr.replace('-', '.').split('.')[0];
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
          config = bip.config,
          pod = this._getPod(cid);

        if ('source' === cid) {
          triggerId = bip.type === 'trigger' ? bip.config.channel_id : null;
          if (triggerId ) {
            fill = 'image_' + this._getPod(triggerId);
          } else {
            fill = 'image_bipio';
          }

          nStruct = {
            channel_id : 'source',
            gone : false,
            fill : fill,
            x : x,
            y : y,
            cx : x,
            cy : y
          };

        } else {
          nStruct.fill = 'image_' + ('flow' === pod ? cid.replace('.', '_') : pod);
        }

        this._bindChannelIcon(nStruct);

        return nStruct;
      },

      _hub2D3 : function(hub) {
        var cid,
        links = [],
        nodes = [],
        // maintain hash list of channel indices, these get fed
        // into links
        linkMap = {},
        edgeNorm = '';

        // feed links forward
        for (var edge in hub) {
//          edge = edge.replace(/\u0001/g, '.');

          if (!linkMap[edge]) {
            linkMap[edge] = this._getNodeStruct(edge, this._actions);
          }

          for (var i = 0; i < hub[edge].edges.length; i++) {
//            cid = hub[edge].edges[i].replace('.', '-');
            cid = hub[edge].edges[i]; //.replace(/\u0001/g, '.');

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

      _angleRad : function(d, rev) {
        if (rev) {
          return Math.atan2(d.source.y - d.target.y, d.source.x - d.target.x) ;
        } else {
          return Math.atan2(d.target.y - d.source.y, d.target.x - d.source.x);
        }
      },

      _tick : function() {
        var self = this;
        var r = this._radius;

        // slow, must be a better way?
        this._link.attr("x1", function(d) {
          var radians = self._angleRad(d);
          return Math.cos(radians) * r + d.source.x;
        })
        .attr("y1", function(d) {
          var radians = self._angleRad(d);
          return Math.sin(radians) * r + d.source.y;
        })
        .attr("x2", function(d) {
          var radians = self._angleRad(d, true);
          return Math.cos(radians) * (r + 7) + d.target.x;
        })
        .attr("y2", function(d) {
          var radians = self._angleRad(d, true);
          return Math.sin(radians) * (r + 7) + d.target.y;
        });

        this._node.attr("cx", function(d) {
          return Math.max(r, Math.min(self._layoutConfig.width - r, d.x));
          //return d.x;
        })
        .attr("cy", function(d) {
          return Math.max(r, Math.min(self._layoutConfig.height - r, d.y));
          //return d.y;
        });

        if (this._node._tooltip) {
          this._node._tooltip
              .style("top", ((parseInt(node.py) - 32) + "px"))
              .style("left", ((parseInt(node.px) - 8) + "px"));
        }

      },

    });
    return HubView;

  });
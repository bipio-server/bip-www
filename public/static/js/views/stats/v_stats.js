define([
    'underscore',
    'backbone',
    'bipclient',
    'd3',
    ], function(_, Backbone, BipClient, d3){

        StatsView = Backbone.View.extend({
            el: $('#account_stats'),
            events: {
            },
            _layoutConfig : {
                width : 870,
                height : 870
            },
            _svg : null,
            _layout : null,

            initialize:function () {
                _.bindAll(
                    this,
                    'render'
                );

                this._layoutConfig.outerRadius = Math.min(
                    this._layoutConfig.width,
                    this._layoutConfig.height) / 2 - 70;

                this._layoutConfig.innerRadius = this._layoutConfig.outerRadius - 24;

                this._arc = d3.svg.arc()
                    .innerRadius(this._layoutConfig.innerRadius)
                    .outerRadius(this._layoutConfig.outerRadius);

                this._layout = d3.layout.chord()
                    .padding(.04)
                    .sortSubgroups(d3.descending)
                    .sortChords(d3.ascending);

                this._path = d3.svg.chord()
                    .radius(this._layoutConfig.innerRadius);

            },

            render: function() {
                var tpl = _.template($('#tpl-resource-stats').html()),
                dict = {};

                this.$el.html(tpl(dict));

                var formatPercent = d3.format(".1%");

                var svg = d3.select("#network-chords").append('svg')
                    .attr("class", "statchords")
                    .attr("width", this._layoutConfig.width)
                    .attr("height", this._layoutConfig.height)
                  .append("g")
                    .attr("id", "circle")
                    .attr("transform", "translate(" + this._layoutConfig.width / 2 + "," + this._layoutConfig.height / 2 + ")");

                var radius = this._layoutConfig.width / 2;

                svg.append("circle")
                    .attr("r", this._layoutConfig.outerRadius);

                // Compute the chord layout.
                this._layout.sortSubgroups(d3.descending).matrix(_chordMatrix);

                // Add a group per neighborhood.
                var group = svg.selectAll(".group")
                    .data(this._layout.groups)
                  .enter().append("g")
                    .attr("class", "group")
                    .on("mouseover", mouseover)
                    .on("mouseout", mouseout);

                // Add a mouseover title.
                group.append("title").text(function(d, i) {
                  //return _chordChannels[i] + ": " + formatPercent(d.value) + " of passes";
                  return _chordChannels[i];
                });

                // setup image fill definitions for available pods
                var pods = [], token;
                for (var i = 0; i < _chordChannels.length; i++) {
                    token = _chordChannels[i].split('.')[0];
                    if (!$.inArray(token, pods) ) {
                        pods.push(token);
                    }                    
                }
                for (var i = 0; i < pods.length; i++) {
                    var defs = svg.append('svg:defs');                    
                    
                    defs.append('svg:pattern')
                    .attr('id', pods[i] === 'undefined' ? pods[i] : 'image_' + this._pods[i] )
                    .attr('patternUnits', 'objectBoundingBox')
                    .attr('height', 16)
                    .attr('width', 16)
                    .append('svg:image')
                    .attr('xlink:href', '/static/img/channels/32/color/' + pods[i] + '.png')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('width', 16)
                    .attr('height', 16);
                }

                var colors = [
                    "#984EA3",
                    "#377EB8",
                    "#3BB9FF",
                    "#9561a9",
                    "#09bab4",
                    "#000000",
                    "#94c83d",
                    "#f6861f",
                    "#f05a79",                    
                    "#f3f61f"
                ];

                var channelColors = {}, nc = colors.length, idx = 0;
                for (var i = 0; i < _chordChannels.length; i++) {
                    if (idx >= nc) {
                        idx = 0;
                    }
                    channelColors[i] = colors[idx];
                    idx++;
                }

                // Add the group arc.
                var groupPath = group.append("path")
                    .attr("id", function(d, i) { return "group" + i; })
                    .attr("d", this._arc)
                    .style("fill", function(d, i) { return channelColors[i] });

                // Add a text label.
/*                
                var groupText = group.append("text")
                    .attr("x", 6)
                    .attr("dy", 15);

                groupText.append("textPath")
                    .attr("xlink:href", function(d, i) { return "#group" + i; })
                    .text(function(d, i) { return _chordChannels[i].split('.')[0]; });
                // Remove the labels that don't fit. :(

                groupText.filter(function(d, i) { return groupPath[0][i].getTotalLength() / 2 - 16 < this.getComputedTextLength(); })
                    .remove();*/
      
                group.append("svg:text")
                  .each(function(d) { d.angle = (d.startAngle + d.endAngle) / 2; })
                  .attr("dy", ".05em")
                  .attr("text-anchor", function(d) { return d.angle > Math.PI ? "end" : null; })
                  .attr("xlink:href", function(d, i) { return "#group" + i; })
                  .attr("transform", function(d) {
                    return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")" +
                      "translate(" + (radius - 65) + ")" +
                      (d.angle > Math.PI ? "rotate(180)" : "");
                  })
                  .text(function(d, i) { return _chordChannels[i].split('.')[0]; });


                // Add the chords.
                var chord = svg.selectAll(".chord")
                    .data(this._layout.chords)
                  .enter().append("path")
                    .attr("class", "chord")
                    .style("fill", function(d) { return channelColors[d.target.index]; })
                    .attr("d", this._path);

                // Add an elaborate mouseover title for each chod.
                chord                    
                    .on("mouseover", function mouseover(d) {
                        chord.classed("focused", function(p) {                                                        
                            return d&& (p.source.index === d.source.index || p.target.index === d.target.index); 
                        });
                    })
                    .on("mouseout", function mouseover(d, i) {
                        chord.classed("focused", function(p) {                            
                            return false; 
                        });
                    })
                    .append("title")
                    .text(function(d) {                    
                        return _chordChannels[d.source.index] + " to " + _chordChannels[d.target.index];
                    });
                    

                function mouseover(d, i) {
                  chord.classed("fade", function(p) {
                    return p.source.index != i
                        && p.target.index != i;
                  });
                };
                
                function mouseout(d, i) {
                    chord.classed("fade", function(p) {
                        return false;
                    });
                }

                return this;
            }
        });

        return StatsView;

    });
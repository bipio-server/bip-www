require.config({
  baseUrl : "/static/js",
  paths: {
    jquery: 'vendor/jquery/jquery-min',
  }
});

define(['jquery' ], function($) {

  var pressed = false,
    frameRequest;

  var numCircles = 40;
  var circleSize = {
    min: 10,
    max: 20
  };

  var circleSpeed = 1;
  var circles = [];
  var lines = [];
  var lineOffset = 4;
  var maxDistance = 90;

  var width, height;

  var colors = {
    circles : "rgba(255,255,255,0.8)",
    lines: "rgba(255,255,255,0.8)"
  }

  var layers = ['circles', 'lines'];

  function random(min, max){
    return Math.random()*(max - min)+min;
  }

  function sq(num){
    return num*num;
  }

  function getDist(x1,y1,x2,y2){
    var dx = x1 - x2;
    var dy = y1 - y2;
    var d = Math.sqrt(sq(dx)+sq(dy));
    var ux = dx/d;
    var uy = dy/d;
    return {
      dx: dx,
      dy: dy,
      d: d,
      ux: ux,
      uy: uy
    }
  }

  function drawCircle(ctx,centerX,centerY,radius,stroke){
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    ctx.fill();
    if (stroke) ctx.stroke();
  };

  function drawLine(ctx,startX,startY,endX,endY){
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  };


  function drawCircles(){
    var layer = layers[0];
    circles.forEach(function(circle){
      // draw circle
      layer.fillStyle = colors.circles;

      drawCircle(layer, circle.x, circle.y, circle.radius);

      // Move circle
      circle.x += circle.vx;
      circle.y += circle.vy;

      // Wrap edges
      if ( circle.x < 0 - circle.radius) {
        circle.x = width+circle.radius;
      }
      if ( circle.x > width+circle.radius ) {
        circle.x = -circle.radius;
      }
      if ( circle.y < 0-circle.radius     ) {
        circle.y = height+circle.radius;
      }
      if ( circle.y > height+circle.radius) {
        circle.y = 0-circle.radius;
      }

      circles.forEach(function(circle2){
        var dist = getDist(circle.x,circle.y,circle2.x,circle2.y);
        if ( dist.d < circle.radius + circle2.radius + maxDistance ) {
          lines.push({
            x1: circle.x,
            y1: circle.y,
            x2: circle2.x,
            y2: circle2.y
          });
        }
      });
    })
  }

  function drawLines(){
    var layer = layers[1];
    layer.lineWidth = 3;
    layer.linecap = 'round';
    layer.beginPath();
    layer.strokeStyle = colors.lines;

    lines.forEach(function(line){
      layer.moveTo(line.x1, line.y1);
      layer.lineTo(line.x2, line.y2);
    })

    layer.stroke();
    layer.closePath();
    layer.beginPath();

    layer.stroke();
  }

  function render() {
    layers.forEach(function(layer){
      layer.clearRect(0,0,width,height);
    });

    drawCircles();
    drawLines();
    lines = [];

    frameRequest = requestAnimationFrame(render);
  }

  function setup($el) {

    width = $el.width(),
    height = $el.height();

    $('.layer').css({
      width : width,
      height : height + 63,
      position: 'absolute',
      top: 0
    });


    layers.forEach(function(layer, i){
      layer = document.getElementById('cover-mesh-'+layer).getContext('2d');
      layer.canvas.width = width;
      layer.canvas.height = height;
      layers[i] = layer;
    })

    for (var j=0; j< numCircles; j++) {
      var circle = {
        x: random(0,width),
        y: random(0,height),
        radius: random(circleSize.min, circleSize.max),
        vx: random(-1*circleSpeed, circleSpeed),
        vy: random(-1*circleSpeed, circleSpeed)
      }
      // no overlappers
      var overlapping = false;
      if (!overlapping) circles.push(circle);
    }

    render();
  }

  var ParticleView = function(renderInto) {
    setup($(renderInto));
    this.paused = false;
    window.onresize = function(){
    //setup($(renderInto));
      width = $(renderInto).width(),
      height = $(renderInto).height();
      render();
    }
  }

  ParticleView.prototype.pause = function() {
    window.cancelAnimationFrame(frameRequest);
    this.paused = true;
  }

  ParticleView.prototype.play = function() {
    render();
    this.paused = false;
  }

  return ParticleView;

});
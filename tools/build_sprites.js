#!/usr/bin/env node
/**
 * 
 * Builds channel sprites
 * https://github.com/richardbutler/node-spritesheet
 * 
 * -- still needs some massaging :(
 * 
 */
var Builder = require( 'node-spritesheet' ).Builder,
    fs = require('fs');

var files = [],
    baseDir = __dirname + '/../',
    srcDir = 'public/static/img/channels/32/color/';

var imageFiles = fs.readdirSync(baseDir + srcDir);
for (var i = 0; i < imageFiles.length; i++) {
    files.push(baseDir + srcDir + imageFiles[i]);
}


var builder = new Builder({
    outputDirectory: 'public/static/img/channels/32/',
    outputImage: 'sprite.png',
    outputCss: 'sprite.css',
    selector: '.pod-img',
    images  : files
});

builder.build( function() {
    console.log( "Built from " + builder.files.length + " images" );
});
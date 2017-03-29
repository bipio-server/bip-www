
/*jslint white: true, devel: true, onevar: true, browser: true, undef: true, nomen: true, regexp: true, plusplus: false, bitwise: true, newcap: true, maxerr: 50, indent: 4 */
var jsl = typeof jsl === 'undefined' ? {} : jsl;

/**
 * jsl.format - Provide json reformatting in a character-by-character approach, so that even invalid JSON may be reformatted (to the best of its ability).
 *
 **/
jsl.format = (function () {

  function repeat(s, count) {
    return new Array(count + 1).join(s);
  }
  function changeJSON(textedit,jsonConfig,defaultJsonValue){
        try{
          jsonValue = defaultJsonValue;
          currentValue = JSON.parse(textedit.val());
        jsonValue.name  = currentValue.name;
        jsonValue.note  = currentValue.note;
        jsonValue.end_life = currentValue.end_life;
        jsonValue.paused = currentValue.paused;
                jsonValue.binder = currentValue.binder;
                jsonValue.icon = currentValue.icon;
                if(currentValue.hub.transforms){
                  jsonValue.hub.transforms = {}
                  $.each(currentValue.hub.transforms, function (index, data) {
                    jsonValue.hub.transforms[index] = {};
                    $.each(data,function(key,value){
                        jsonValue.hub.transforms[index][key]=value;
                    });
                    });
                }
                else{
                  delete jsonValue.hub.transforms;
                }
              textedit.val(JSON.stringify(jsonValue, undefined, 4));
              jsonConfig.innerHTML = JSON.stringify(jsonValue, undefined, 4);
              $("#bip_name").val(jsonValue.name);
      }
      catch(e){
        textedit.val(JSON.stringify(jsonValue ,undefined, 4));
        jsonConfig.innerHTML = JSON.stringify(jsonValue, undefined, 4);
      }
  }
  function formatJson(json) {
    var i           = 0,
    il          = 0,
    tab         = "    ",
    newJson     = "",
    indentLevel = 0,
    inString    = false,
    currentChar = null;

    for (i = 0, il = json.length; i < il; i += 1) {
      currentChar = json.charAt(i);

      switch (currentChar) {
        case '{':
        case '[':
          if (!inString) {
            newJson += currentChar + "\n" + repeat(tab, indentLevel + 1);
            indentLevel += 1;
          } else {
            newJson += currentChar;
          }
          break;
        case '}':
        case ']':
          if (!inString) {
            indentLevel -= 1;
            newJson += "\n" + repeat(tab, indentLevel) + currentChar;
          } else {
            newJson += currentChar;
          }
          break;
        case ',':
          if (!inString) {
            newJson += ",\n" + repeat(tab, indentLevel);
          } else {
            newJson += currentChar;
          }
          break;
        case ':':
          if (!inString) {
            newJson += ": ";
          } else {
            newJson += currentChar;
          }
          break;
        case ' ':
        case "\n":
        case "\t":
          if (inString) {
            newJson += currentChar;
          }
          break;
        case '"':
          if (i > 0 && json.charAt(i - 1) !== '\\') {
            inString = !inString;
          }
          newJson += currentChar;
          break;
        default:
          newJson += currentChar;
          break;
      }
    }

    return newJson;
  }

  function changeToEditable(json){
   var jsonObject = JSON.parse(json);
   var stringValuesArray = ["name","note","icon","end_life.action"]
   var nonStringValuesArray = ["paused","end_life.imp","end_life.time"]
   var arrayValuesArray = ["binder"]
   stringValuesArray.forEach(function(item){
     try{
     var stringToSplit;
     if(item.split(".").length!=1){
       stringToSplit = '"'+item.split(".")[1]+'": "'+jsonObject[item.split(".")[0]][item.split(".")[1]]+'"';
       item = item.split(".")[1];
     }
     else{
       stringToSplit = '"'+item+'": "'+jsonObject[item]+'"';
     }
     var splitjson = json.split(stringToSplit);
     if(splitjson.length>1){
     var _splitjson = stringToSplit.split(":");
     json = splitjson[0]+
     '<span>'+_splitjson[0]+'</span>:"<span contenteditable=true '+((item=="name")?'id="bip-name"':'')+'>'+_splitjson[1].split('"')[1]+'</span>"'+splitjson[1];
     }
     }
     catch(e){

     }
     });
   nonStringValuesArray.forEach(function(item){
     try{
     var stringToSplit;
     if(item.split(".").length!=1){
       stringToSplit = '"'+item.split(".")[1]+'": '+jsonObject[item.split(".")[0]][item.split(".")[1]];
       item = item.split(".")[1];
     }
     else{
       stringToSplit = '"'+item+'": '+jsonObject[item];
     }
     var splitjson = json.split(stringToSplit);
     if(splitjson.length>1){
     var _splitjson = stringToSplit.split(":");
     json = splitjson[0]+
     '<span >'+_splitjson[0]+'</span>:<span contenteditable=true>'+_splitjson[1]+'</span>'+splitjson[1];
     }
     }
     catch(E){}
     });
   arrayValuesArray.forEach(function(item){
     stringToSplit = '"'+item+'": '+JSON.stringify(jsonObject[item]);
     var splitjson = json.split(stringToSplit);
     if(splitjson.length>1){
     var _splitjson = stringToSplit.split(":");
     var arrayValues="" ;
     try{
     var array = JSON.parse(_splitjson[1]);
     if(array.length>0){
     arrayValues = '"'+array[0]+'"';
     for(var i=1;i<array.length;i++){
       arrayValues = '\n,"'+array[i]+'"'
     }
     }
     }
     catch(e){}
     json = splitjson[0]+
     '<span >'+_splitjson[0]+'</span>:[<span contenteditable=true>'+arrayValues+'</span>]'+splitjson[1];
     }
   })
   try{
   jsonObject.hub.transforms.forEach(function(_item){
     _item.forEach(function(item){
       try{
       stringToSplit = '"'+item+'": "'+jsonObject[item]+'"';
       var splitjson = json.split(stringToSplit);
       if(splitjson.length>1){
       var _splitjson = stringToSplit.split(":");
       json = splitjson[0]+
       '<span >'+_splitjson[0]+'</span>:"<span contenteditable=true>'+_splitjson[1].split('"')[1]+'</span>"'+splitjson[1];
       }
       }
       catch(e){

       }
     })
   })
   }
   catch(ex){

   }
   return json;
  }

  return {
    "formatJson": formatJson,
    "changeJSON": changeJSON,
    "changeToEditable":changeToEditable
  };

}());

define([
  'underscore',
  'backbone',
  'bipclient'
  ], function(_, Backbone, BipClient){

    BipDataView = Backbone.View.extend({
      tplParser :  _.template( $('#tpl-bipio-data').html() ),
      events: {
      },
      initialize:function (tabContainer, contentContainer) {
        var self = this;
        _.bindAll(
          this,
          'render'
          );

        var containerId = 'bip-data-panel';

        $(tabContainer).append(
          '<li><a data-toggle="pill" href="#' + containerId + '"> Data View</a></li>'
        );

        $(contentContainer).append(
          '<div class="tab-pane span12" id="' + containerId + '"></div>'
        );

        this.el = '#' + containerId;
        this.$el = $(this.el);

        // set tab content
        this.$el.html(
          this.tplParser()
        );
      },

      publish : function() {
        var jsonConfigDom = ($("#bip-data-panel pre").first()[0]);
        var jsonConfigValue;
        if(false && jsonConfigDom){
          jsonConfigValue = JSON.parse(jsonConfigDom.textContent);
          bipStruct.note = $.trim(($('#bip_note').val()!=jsonConfigValue.note)?jsonConfigValue.note:$('#bip_note').val());
          bipStruct.end_life = (end_life!=jsonConfigValue.end_life)?jsonConfigValue.end_life:end_life;
          bipStruct.paused = jsonConfigValue.paused;
          bipStruct.binder = jsonConfigValue.binder;
          bipStruct.icon = jsonConfigValue.icon;
          bipStruct.hub = jsonConfigValue.hub;
        }

      },

      render : function(model) {
        var editableJSON = model.toJSON();

        delete editableJSON.created;

        _.each(editableJSON, function(value, key) {
          if (0 === key.indexOf('_')) {
            delete editableJSON[key];
          }
        });

        $('pre', this.$el).html(
//          jsl.format.changeToEditable(
            JSON.stringify(JSON.parse(
              BipClient.htmlEncode(
                JSON.stringify(editableJSON)
              )
            ), undefined, 4
          )
//          )
        );
      }

    });

    return BipDataView;
  });
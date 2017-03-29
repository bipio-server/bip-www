define(['jquery'], function($) {
	var Hub = function(modalHandler, wsHost, ifexe_v) {
		var self = Hub;	
		self.socket = null;
		self.children = [];
		self.modalHandler = modalHandler;
		self._wsHost = (wsHost) ? wsHost : null;
		self._ifexe_v = (ifexe_v) ? ifexe_v : null; //To be backward compatible
		self.register = function(child, json) {
			//console.log("registering child",child)
			if (self.children.indexOf(child) >= 0) return;
			self.children.push(child)

			if (typeof child['postMessage'] == 'function')  {
				self.setupChild(child, json);
			}
			
			//console.log("registered child",child)
			if (self.isOpen()) {
				console.log("Socket already Opened")
				if (typeof child['postMessage'] == 'function') {
	          		//console.log('ALREADY OPEN, POSTING...');
	          		child.postMessage(JSON.stringify(["socket_opened"]), "*");
	        	}
			}
		}
		
		
		self.getChildURLParameter = function(url, sParam) {
		    var sPageURL = url.split("?")[1];
		    var sURLVariables = sPageURL.split('&');
		    for (var i = 0; i < sURLVariables.length; i++)
		    {
		        var sParameterName = sURLVariables[i].split('=');
		        if (sParameterName[0] == sParam)
		        {
		            return sParameterName[1];
		        }
		    }
		    
		    return null;

		}
		
		self.setupChild = function(child, json) {
			
			//In case same origin no need to query, check if same origin and use child.frameElement
			var frameElement = document.querySelectorAll("iframe[src='"+json[2]+"'")[0]
			
			
			frameElement.setAttribute("scrolling", "no");
			frameElement.style.overflow = "hidden";
			
			var wotId  = self.getChildURLParameter(json[2], "wotio-widget")
			
			frameElement.setAttribute("wotio-widget", wotId);
			frameElement.setAttribute("id", wotId);
			
			var height = self.getChildURLParameter(json[2], "height");
			if(height)
				frameElement.setAttribute("height", height);
			
			var maxHeight =  self.getChildURLParameter(json[2], "maxHeight");
			if(maxHeight)
				frameElement.setAttribute("maxHeight", maxHeight);
			
			var minHeight =  self.getChildURLParameter(json[2], "minHeight");
			if(minHeight)
				frameElement.setAttribute("minHeight", minHeight);
			
			var width = self.getChildURLParameter(json[2], "width")
			if(width)
				frameElement.setAttribute("width", width );
		}

	     var handler = function(exclude) {
			return function(message) {
				if(message.data instanceof Blob) {
					var reader = new FileReader();  
				    reader.readAsText(message.data); 
				    reader.onload = function() {   
				        self.handleMessage(reader.result, message, exclude)
				    }
				    reader.onerror = function(e) { 
				        console.log("Error", e);    
				    };
				} else {
					self.handleMessage(message.data, message, exclude);
				}
			}
		}
		
		//Handle Message Propagation
		self.handleMessage = function(data, message, exclude) {
			var excluded = exclude;
			if (message.source) excluded = message.source;
			try {	
				json = JSON.parse(data)
				//console.log("message ", json)
				if(json[0] != "bipio") console.log(data)
				if (json[0] == 'widget' && message.source) self.register(message.source, json);
				if (json[0] == 'loggedin' && message.source) {
					if (self.isOpen()) {
						console.log("Socket already Opened")
		          		window.postMessage(JSON.stringify(["socket_opened"]), "*");
					} else {
						self.openConnection(json);
					}
					return; //Don't send the message to any children
				}
				if (json[0] == 'resize' && message.source) {
					document.querySelector("[wotio-widget='"+json[1]+"']").style.height = json[2];
					document.querySelector("[wotio-widget='"+json[1]+"']").setAttribute("height", json[2])
					return; //Don't send the message to any children
				}
				if(json[0] == 'load_info') {
					self.publishChildFrameInfo(message.source, document.querySelector("[wotio-widget='"+json[1]+"']"))
				}
				if (json[0] == 'logout' && message.source) {
					self.closeConnection();
					return; //Don't send the message to any children
				}
				if(json[0] == 'render_modal') {
					if(self.modalHandler != null) {
						message.source.postMessage(JSON.stringify({"render_modal": true}), "*");
						self.modalHandler.renderModal(json[1]);
					} else {
						message.source.postMessage(JSON.stringify({"render_modal": false, "msgid": json[1]['msgid']}), "*");
					}
					return;
				}
			} catch (E) {
				//Socket sends empty messages
				//console.log("Catch Error",E) 
			}
			self.children.filter(function(child) { 
				return excluded != child
			}).map(function(child) { 
				if (typeof child['postMessage'] == 'function') {
					child.postMessage(data,"*")
					//console.debug("Message sent to windows: ", data)
				}
				try{
					if (typeof(child['send']) == 'function') {
						child.send(data)
						console.debug("Message sent to socket: ",data)
					}
				} catch(e) {
					//console.debug("Checked if socket, but am a window with a cross origin domain")
				}
			})
		}
		
		//Broadcast frame predefined min & max height
		self.publishChildFrameInfo = function(child, frameElement) {
			var maxHeight = frameElement.getAttribute("maxHeight") ? parseInt(frameElement.getAttribute("maxHeight")) : NaN;
			var minHeight = frameElement.getAttribute("minHeight") ? parseInt(frameElement.getAttribute("minHeight")) : NaN;
			
			if(isNaN(maxHeight)) {
				maxHeight = 0;
			}
			
			if(isNaN(minHeight)) {
				minHeight = 0;
			}
			child.postMessage(JSON.stringify({"frame_info": [minHeight, maxHeight] }), "*")
		}
		
		self.openConnection = function(info) {
			
			if(self.socket != null) {
				self.socket.close();
			}
			
			var queuename = info[3] + "." + Date.now();
			var username = info[2];
			var token = info[3];
		
			var socket_protocol = (window.location.protocol == "https:") ? "wss:" : "ws:";
			self.url = "";
			var postUrl = "";
			
			//socket url passed by integrator(ex: bipio)
			if(self._wsHost) {
				if(self._ifexe_v && self._ifexe_v == "1") { //Backward compatible
					self.url =  self._wsHost + "/management/console/%23/"+ queuename + "/wotio/" + username + "/" + token;
				} else {
					self.url = self._wsHost.split("//")[0] + "//" + token + "@" + self._wsHost.split("//")[1] + "/management/"+ queuename + "/wotio/"+username+"?apikey="+token;
					postUrl = (self._wsHost.split("//")[0] == "wss:") ? "https:" : "http:"  + "//" + self._wsHost.split("//")[1]  + "/management/console/"+queuename+"/%23";
				}
			} else {//In case default socket url is overriden
				if(typeof config !== 'undefined' && config !== null) {
					if(config.socket_url && config.socket_url != "") {
						if(config.ifexe_version == "1") { //Backward compatible
							self.url =  socket_protocol +"//"+ config.socket_url + "/management/console/%23/"+ queuename + "/wotio/" + username + "/" + token;
						} else {
							self.url =   socket_protocol +"//" + config.socket_url + "/management/"+ queuename + "/wotio/" + username + "?apikey=" + token;
							postUrl =  ((socket_protocol == "wss:") ? "https:" : "http:")  + "//" + config.socket_url + "/management/console/"+queuename+"/%23";
						}
					}
					
					//In case we need to fetch data from a test server
					if(config.isTestMode && config.isTestMode == true) {
						if(config.socket_url && config.socket_url != "") {
							self.url =  config.socket_url;
						} else {
							var account =  document.location.hostname.split(".")[1];
							if(config.account && config.account != "") 
								account = config.account;
							self.url = "ws://localhost."+account+".wot.io:3000"
						}
					}
				} else { //Default socket url, need to be retrieved from url
					 if(config.ifexe_version == "1") { //Backward compatible
						 self.url = socket_protocol + "//" + document.location.host +":8080" + "/management/console/%23/"+ queuename + "/wotio/" + username + "/" + token;
					 } else {
						 self.url = socket_protocol + "//" + token + "@" +document.location.host +":8080" + "/management/"+ queuename + "/wotio/" + username+"?apikey="+token;
						 postUrl =  ((socket_protocol == "wss:") ? "https:" : "http:")  + "//" + token + "@" +document.location.host +":8080" + "/management/console/"+queuename+"/%23";
					 }	 
				}
			}
			
			console.log("POST URL TO BIND: "+postUrl);
			if(postUrl && postUrl != "") {
				self.processRequest("POST", postUrl, token, function(self, data) {
					self.socket_setup();
				});
			} else {
				self.socket_setup();
			}
		}
		
		
		self.socket_setup = function() {
			console.log("Socket Url:",self.url)
			self.socket = new WebSocket(self.url);
			self.socket.addEventListener("message", handler(self.socket),false);
			
			self.socket.addEventListener("open", function() {
				//Register socket on socket open
				self.register(self.socket);
				window.postMessage(JSON.stringify(["socket_opened"]), "*");
			});
			
			self.socket.addEventListener("close", function() { 
				console.log("socket closed"); 
				//Remove Socket from children
				self.children.splice(self.children.indexOf(self.socket),1);
				window.postMessage(JSON.stringify(["socket_closed"]), "*");
			});
			
			self.socket.addEventListener("error", function(E) { 
				console.debug("socket error",E); 
			});
		}
		
		/**
		 *  Build the actual CORS request
		 */
		self.processRequest = function processRequest(method, url, token, callback) {
			var xhr = this.createCORSRequest(method, url);
			if (!xhr) {
				alert('CORS not supported');
				return;
			}
			
		   xhr.setRequestHeader( "Authorization", "Bearer " + token );

			//var self = this;
			// Response handlers.
			xhr.onload = function() {
				var text = xhr.responseText;
				try {
					var data = JSON.parse(text);
					console.log(data);
					callback(self, data, token);
				} catch (error) {
					console.log(error);
				}
			};
		
			xhr.onerror = function() {
				$('#messages').text("An XHR occured!");
				window.parent.postMessage('[{"code":"error", "message": "XHR error"}]', "*");
			};
		
			xhr.send();
		}
		
		
		/**
		 *  Create the XHR object.
		 *  @return xhr object
		 */
		 self.createCORSRequest = function createCORSRequest(method, url) {
			var xhr = new XMLHttpRequest();
			if ("withCredentials" in xhr) {
				// XHR for Chrome/Firefox/Opera/Safari.
				xhr.open(method, url, true);
			} else if (typeof XDomainRequest != "undefined") {
				// XDomainRequest for IE.
				xhr = new XDomainRequest();
				xhr.open(method, url);
			} else {
				// CORS not supported.
				xhr = null;
			}
			return xhr;
		}
		self.closeConnection = function() {
			if(self.socket != null) {
				self.socket.close();
			}
		}

		self.isOpen = function() {
	    	return (self.socket && 1 === self.socket.readyState);
	  	}

		window.addEventListener("message",handler(),false);
		return self;
	}
	return Hub;
  });

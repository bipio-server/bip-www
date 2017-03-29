var bipioWidgetStack = bipioWidgetStack || [];

var loadBipioWidgets = loadBipioWidgets || function loadBipioWidgets() {
	var el = jQuery(bipioWidgetStack.shift());
	var shareId = el.data('share-id');
	var scriptHost = el.children('script').attr('src').replace('/static/js/widget-loader.js', '');
	var embedHost = el.children('script').data('embed-host');
	jQuery.get(embedHost+'/rpc/oembed/?url='+scriptHost+'/share/'+shareId, function(data) {
		el.html(data.html);
		if (el.attr("width")) el.children('iframe').attr("width", el.attr("width"));
	});
}

bipioWidgetStack.push(document.currentScript.parentNode);

if (typeof jQuery == 'undefined') {
	var usingOtherJSLibrary = false;

	if (typeof $ == 'function') {
		usingOtherJSLibrary = true;
	}

	function getScript(url, success) {

		var script = document.createElement('script');
		script.src = url;

		var head = document.getElementsByTagName('head')[0],
		done = false;

		script.onload = script.onreadystatechange = function() {
			if (!done && (!this.readyState || this.readyState == 'loaded' || this.readyState == 'complete')) {

				done = true;
				success();

				script.onload = script.onreadystatechange = null;
				head.removeChild(script);
			};
		};
		head.appendChild(script);
	};

	getScript('https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js', function() {
		if (typeof jQuery == 'undefined') {
			console.error("Error loading Bipio Widget")
		}
		else {
			if (usingOtherJSLibrary === true) $.noConflict()
			loadBipioWidgets()
		}
	});
}
else {
	loadBipioWidgets()
};
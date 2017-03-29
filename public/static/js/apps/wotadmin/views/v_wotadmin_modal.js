define([
        'jquery',
        'backbone',
    ], function($, Backbone ){

	var Modal = Backbone.View.extend({
		template: _.template( $('#tpl-wotadmin-modal').html()),
		el: '#wotadmin-modal-container',
		callBackEvent: _.extend({},Backbone.Events),

//		modal_data = {
//				type: "confirm",
//				title: "",
//				body: "",
//				events: [{"id": "cancel", "label":"Cancel" },{"id": "ok", "label": "Ok" }],
//				onclose:"cancel", //and event ID
//				msgid: "modal_delete_group_"+todelete //Used for recommunication using window.postMessage
//					
//			}	
		
		model : {}, 
		
		initialize: function(options){
		    _.bindAll(this, 'render', 'callback');
		} ,
		
	    events: {
	    },
	    
	    render: function() {
	    	var self = this,
	    	$modalTpl,
	    	$modal;
	    	
	    	$modalTpl= this.template(this.model)
	    	this.$el.html($modalTpl);

        	$modal = $('#wotadmin-modal', this.$el);
        	
        	
        	
        	$('button.callback', $modal).click(function(event) {
        		self.callback(event, $modal);
        	});
        	
        	//Button with eventId == onclose
        	if(this.model && this.model.onclose) {
        		$("button[trigger='"+ this.model.onclose +"']").click(function(event) {
            		$modal.modal("hide")
            	});
        	}
        	
        	$('button.close', $modal).click(function() {
        		$modal.modal("hide")
        	});
        	
        	$modal.modal('show').on('hidden', function() {
        		self.unbindModal($modal);
        		self.model = {};
        		$modal.remove();
        	});
        	
        	
	 	    return this;
	    },
	    
	    unbindModal: function(modal) {
	    	$('button.close', modal).unbind('click');
    		$("button[trigger='"+ this.model.onclose +"']").unbind('click');
    		$('button.callback', modal).unbind('click');
	    },
	    
		renderModal:function(json){
			this.model = json;
			this.render();
		},
		
		callback:function(target, modal){
			if(this.model && this.model.msgid) {
				var callback_msg = "{\""+this.model.msgid +"\" :[\""+ target.currentTarget.attributes['trigger'].value +"\"]}"
				//console.log(callback_msg)
				window.postMessage(callback_msg,'*');
				modal.modal("hide")
				//console.log("modal hide")
			}
		}

	});
	return Modal;
 })
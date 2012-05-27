App = changer.pg.App.extend({
	postInitialize: function() {
		//this.hello();
	},
	hello: function() {
		this.alert('HELLO_WORLD');
	}
});

function bodyLoad() {
	document.addEventListener('backbutton', function(e) {
		e.preventDefault();
	}, true);
	document.addEventListener('touchmove', function(e) {
	}, false);
	document.addEventListener('deviceready', deviceReady, false);
	// NOT IN PHONEGAP MODE
	if(/https?:\/\//.test(document.location.href)) {
		deviceReady();
	}
}

function deviceReady() {
	if(!window.app) {
		window.app = new App();
	}
}
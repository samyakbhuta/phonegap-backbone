window.TOUCH_EVENT = window.app_env && /(ios)/.test(app_env) ? 'tap' : 'click';
window.CLICK_AND_TOUCH_EVENT = (TOUCH_EVENT == 'click' ? '' : 'click') + ' ' + TOUCH_EVENT;

$.fn.touch = function(callback) {
	var el = this;
	return el.unbind(TOUCH_EVENT).bind(TOUCH_EVENT, function(e) {
		e.preventDefault();
		e.stopPropagation();
		callback.call($(this));
	});
};

String.prototype.format = String.prototype.f = function() {
	var s = this,
		i = arguments.length;
	while (i--) {
		s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
	}
	return s;
};

changer = window.changer || {};
changer.pg = changer.pg || {};

changer.pg.App = Backbone.Router.extend({
	routes: {
		':page': 'page'
	},
	pageQuery: function() {
		return $('body > article');
	},
	initialize: function() {
		var that = this;
		if(document.location.hash !== '') {
			document.location.hash = '';
		}
		// FOR UNKNOWN REASON ANDROID DOESN'T ALWAYS RENDER CORRECTLY
		if(this.android) {
			var article = $('article.active');
			article.hide();
			setTimeout(function() {
				article.show();
			}, 5);
		}
		this.initializePages();
		this.initializeEnvironment();
		this.initializeLinks();
		this.initializeDataFiles();
		this.initializeMessages(function() {
			return that.postInitialize && that.postInitialize();
		});
	},
	initializePages: function() {
		// CREATE PAGES COLLECTION
		var that = this;
		this.pages = new changer.pg.Pages();
		this.pageQuery().each(function(i, article) {
			var id = article.getAttribute('id');
			that.pages.add(new changer.pg.Page({ router: that, id: id }));
		});
		this.createTabBars(this.pageQuery());
		Backbone.history.start();
	},
	initializeEnvironment: function() {
		// SET CSS CLASSES
		if(window.app_env) {
			$('html').addClass(app_env);
			this.ios = app_env == 'ios';
			if(this.ios) {
				this.ipad = /ipad/i.test(navigator.userAgent);
				$('html').addClass('ipad');
			}
			this.android = app_env == 'android';
			this.web = app_env == 'web';
		}
		if(this.android && /Android *4/i.test(navigator.userAgent)) {
			$('html').addClass('android-4');
		}
		// OPTIMIZE DIMENSIONS
		var height = 480;
		height = Math.max(height, window.innerHeight);
		$('body, article').height(height);
		window.scrollTo(0, this.ios ? 0 : 1);
	},
	initializeLinks: function() {
		var that = this;
		// ANDROID's :active is delayed too much for us
		if(this.android) {
			$('body').on('touchstart', 'a', function(e) {
				var link = $(this);
				$(this).addClass('active');
				setTimeout(function() {
					link.removeClass('active');
				}, 750);
			});
		}
		$('body').on(CLICK_AND_TOUCH_EVENT, 'a', function(e) {
			var touch = (e.type == TOUCH_EVENT),
				link = $(this),
				href = link.attr('href'),
				className = link.attr('class');
			if(touch) {
				if(/^#/.test(href)) {
					if(link.attr('data-back')) {
						that.backId = link.attr('data-back');
					}
					that.changePage(href.substring(1));
				}
				else if(/javascript:\/\//.test(href) && /route-([^ ]+)/.test(className)) {
					var func = RegExp.$1;
					if(that[func]) {
						that[func]();
					}
				}
				else if(link.hasClass('submit-form')) {
					link.parents('form').first().submit();
				}
				else {
					document.location.href = href;
				}
			}
			e.preventDefault();
			e.stopPropagation();
			return false;
		});
	},
	initializeDataFiles: function() {
		var that = this;
		this.dataFiles = [];
		var json = $('#data');
		if(json.length) {
			json = json.html();
			if(json.length) {
				this.dataFiles = JSON.parse(json);
			}
		}
		// ADAPT AJAX TO FALLBACK TO EMBEDDED DATA
		var ajax = $.ajax;
		$.ajax = function(options) {
			var settings = $.extend({}, options || {});
			for(var key in $.ajaxSettings) {
				if(settings[key] === undefined) settings[key] = $.ajaxSettings[key];
			}
			if(/^data\/(.*)$/.test(settings.url)) {
				var name = RegExp.$1,
					data = that.dataFiles[name];
				if(data) {
					if(settings.dataType == 'json') {
						data = JSON.parse(data);
					}
					return settings.success(data);
				}
			}
			ajax(options);
		};
	},
	initializeMessages: function(callback) {
		var that = this;
		this.getLines('messages', function(data) {
			that.messages = {};
			$.each(data, function(i, val) {
				if(/^([A-Z_]+) (.*?)$/.test(val)) {
					that.messages[RegExp.$1] = RegExp.$2;
				}
			});
			if(callback) {
				callback();
			}
		}, true);
	},
	createTabBars: function(obj) {
		obj.find('footer').each(function(i, footer) {
			footer = $(footer);
			var p = footer.parents('article').first(),
				tabbar = $('body > code > ul.tabbar').first();
			if(!footer.find('.tabbar').length) {
				footer.append(tabbar.get(0).cloneNode(true));
				footer.find('ul li a.' + p.attr('id')).addClass('active');
			}
		});
	},
	changePage: function(id) {
		this.navigate(id, { trigger: true });
		return this.pages.get(id);
	},
	translatePageId: function(id) {
		return id;
	},
	navigate: function() {
		var args = Array.prototype.slice.call(arguments);
		args[0] = this.translatePageId(args[0]);
		Backbone.Router.prototype.navigate.apply(this, args);
	},
	page: function(id) {
		var that = this,
			page = this.pages.get(id),
			fetch = false,
			loader;
		if(!page) {
			fetch = true;
			page = this.createPage(id);
		}
		if(fetch) {
			var backId = this.activePage().attr('id');
			if(this.backId) {
				backId = this.backId;
				this.backId = null;
			}
			return this.loadStaticPage(page, id, backId, function() {
				that.page(id);
			});
		}
		loader = this['load_' + id.replace('-', '_')];
		if(loader) {
			loader.call(this, page);
		}
		return page && page.show() && page;
	},
	createPage: function(id) {
		var view = $($('body > code > article').get(0).cloneNode(true)).appendTo('body');
		view.attr('id', id);
		this.pages.add(new changer.pg.Page({ router: this, id: id }));
		return this.pages.get(id);
	},
	loadStaticPage: function(page, id, backId, callback, data) {
		var that = this,
			set = function(data) {
				var view = page.view.$el;
				view.find('header').prepend('<a class="back" href="#' + backId + '">&#160;</a>');
				that.createTabBars(view);
				data = that.preRender(data);
				var section = view.find('section');
				section.html(data);
				that.postRender(section);
				return callback && callback.call(that, page);
			};
		return data ? set(data) : this.getLines(id, set);
	},
	preRender: function(data) {
		if(window.Showdown) {
			this.showdown = this.showdown || new Showdown.converter();
			data = this.showdown.makeHtml(data.join('\n'));
		}
		return data;
	},
	postRender: function(section) {
		var h1 = section.find('h1');
		if(h1.length) {
			section.parents('article').first().find('header h1').text(h1.first().text());
			h1.first().remove();
		}
	},
	activePage: function() {
		return $('body > article.active');
	},
	isPageActive: function(id) {
		return this.activePage().attr('id') == id;
	},
	getMessage: function(key, args) {
		return (this.messages && this.messages[key] || key).format(args);
	},
	getLines: function(name, callback, strip) {
		var fileName = 'data/' + name + '.txt';
		var d = new Date();
		$.get(fileName, function(data) {
			data = data.replace(/\r/g, '');
			var rx = strip ? /[\n]+/ : /[\n]/;
			data = data.split(rx);
			callback(data);
		});
	},
	alert: function(message, args) {
		message = this.getMessage(message, args);
		if(navigator && navigator.notification && navigator.notification.alert) {
			navigator.notification.alert(message, function(){}, document.title);
		}
		else {
			window.alert(message);
		}
	},
	confirm: function(yes, no, message, args) {
		message = this.getMessage(message, args);
		var callback = function(ok) {
			if(ok) {
				return yes && yes();
			}
			return no && no();
		};
		if(navigator && navigator.notification && navigator.notification.confirm) {
			navigator.notification.confirm(message, function(index) {
				callback(index == 1);
			}, document.title, 'Ja,Nee');
		}
		else {
			callback(window.confirm(message));
		}
	},
	isConnectionAvailable: function() {
		if(this.web || !Connection) {
			return true;
		}
		var networkState = navigator.network.connection.type;
		return networkState != Connection.NONE && networkState != Connection.UNKNOWN;
	},
	isConnectionAvailableFor: function(key) {
		var a = this.isConnectionAvailable();
		if(!a) {
			this.alert(key);
		}
		return a;
	}
});

changer.pg.Page = Backbone.Model.extend({
	defaults: {},
	initialize: function() {
		this.router = this.get('router');
		this.unset('router');
		this.view = new changer.pg.PageView({ model: this, el: $('#' + this.id) });
	},
	show: function() {
		this.view.show();
	}
});

changer.pg.Pages = Backbone.Collection.extend({
	model: changer.pg.Page
});

changer.pg.PageView = Backbone.View.extend({
	tagName: 'article',
	initialize: function() {
	},
	render: function() {
	},
	show: function() {
		var el = this.$el,
			section = this.$el.find('section'),
			show = function() {
				el.addClass('active fromLeft').removeClass('toLeft toRight');
			};
		el.trigger('show');
		this.model.router.pageQuery().not(this.$el).filter('.active').removeClass('active').addClass('toRight').trigger('hide');
		this.loading();
		// Sometimes in iOS5 the scrolling doesn't work straight away, this patch resolves that
		if('WebkitOverflowScrolling' in document.documentElement.style && !section.hasClass('no-scroll')) {
			setTimeout(function() {
				var dummy = $('<div>' + new Array(2500).join('&#160;') + '</div>');
				dummy.appendTo(section);
				setTimeout(function() {
					dummy.remove();
					show();
				}, 5);
			}, 100);
		}
		else {
			show();
		}
	},
	loading: function() {
		var that = this;
		if(typeof document.documentElement.style.WebkitOverflowScrolling != 'string' && window.iScroll) {
			var section = this.$('section'),
				article = section.parents('article').first(),
				rows = article.children('div'),
				scrollerId = 'scroller_' + that.$el.attr('id'),
				height = $('body').height() -
					rows.eq(0).height() -
					rows.eq(2).height() -
					parseInt(section.css('padding-top'), 10) -
					parseInt(section.css('padding-bottom'), 10) -
					parseInt(section.css('margin-top'), 10) -
					parseInt(section.css('border-top-width'), 10) -
					parseInt(section.css('border-bottom-width'), 10);
			section.css('height', height + 'px');
			section.attr('id', scrollerId);
			if(!section.hasClass('no-scroll') && !that.iScroll) {
				that.iScroll = new iScroll(scrollerId);
			}
		}
		setTimeout(function() {
			that.loaded();
		}, 500);
		this.$el.bind('touchstart.prevent click.prevent tap.prevent', function(e) {
			e.stopPropagation();
			e.preventDefault();
			return false;
		});
	},
	loaded: function() {
		this.$el.unbind('touchstart.prevent click.prevent tap.prevent');
		this.$el.removeClass('toLeft toRight fromLeft fromRight');
	}
});

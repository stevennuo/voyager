var fs					=	require('fs');
var cron 				= require('cron');
var path 				= require('path');
var async 			= require('async');
var redis 			= require("redis");
var request 		= require('request');
var Promise			=	require('promise');
var mongoose		= require('mongoose');
var ProgressBar = require('progress');
var _						= require('underscore');

require('colors');

var Engine = function(options){
	this.configs = _.extend({
		config 	: './config/config',
		crontab	: './config/crontab',
		tasks		: './tasks',
		filters : './filters'
	}, options);

	this.root = __dirname;

	this.tasks = {};
	this.filters = {};
	this.crontab = {};

	this.load();
};

([ 'running', 'stop', 'error' ]).forEach(function(status){
	Engine[ status.toUpperCase() ] = status;
});

Engine.prototype._ = _;
/**
 * [init func]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Engine.prototype.init = function(callback){
	var engine = this;
	this.cache = redis.createClient();
	mongoose.connect(engine.config('db'), function(err, db){
		callback(engine);
	});
};
/**
 * [load description]
 * @return {[type]} [description]
 */
Engine.prototype.load = function(){
	var engine = this;
	//load config file.
	require(engine.config('config'))(engine);
	//load crontab file.
	require(engine.config('crontab'))(engine);
	//
	require('./model');
	//
	fs.readdir(engine.config('tasks'), function(err, files){
		files.forEach(function(filename){
			console.log('loading task: %s', filename.red);
			require(path.join(engine.root,engine.config('tasks'), filename))(engine);
		});
	});

	fs.readdir(engine.config('filters'), function(err, files){
		files.forEach(function(filename){
			console.log('loading filter: %s', filename.red);
			require(path.join(engine.root,engine.config('filters'), filename))(engine);
		});
	});
};

Engine.prototype.bootstrap = function(){
	_.each(this.crontab, function(cronjob, name){
		cronjob.start();
	})
};

Engine.prototype.model = function(name){
	return mongoose.model(name);
};

Engine.prototype.cron = function(crontab){
	var engine = this;
	for(var job in crontab){
		(function(key){
			var job = crontab[ key ];
			var cronjob = new cron.CronJob(job, function(){
				if(engine.status(key) != Engine.RUNNING){
					console.log('cron: %s starting ', key.green);
					engine.run(key);
				}else{
					// console.log('%s already running'.red, key);
				}
			}, engine.noop, false, '');
			engine.crontab[ key ] = cronjob;
		})(job);
	}
};

Engine.prototype.config = function(key, val){
	if(typeof key == 'function'){
		var env = process.env.NODE_ENV || 'development';
		this.configs = _.extend(this.configs, key(env));
	}else{
		if(val){
			this.configs[key] = val;
		}else{
			return this.configs[key];
		}
	}
};

Engine.prototype.require = function(requirement_list, callback){
	var engine = this;
	var requirements = [];
	requirement_list.forEach(function(requirement_name){
		requirements.push( require('./' + requirement_name)(engine) );
	});
	callback.apply(callback, requirements);
};


Engine.prototype.async = function(tasks){
	return {
		parallel: function(callback){
			async.parallel(tasks, callback)
		},
		series: function(callback){
			async.series(tasks, callback);
		}
	};
};

Engine.prototype.noop = function(callback){};

Engine.prototype.promise = function(callback){
	return new Promise(callback)
};

Engine.prototype.task = function(name, deps, func){
	if(typeof deps == 'function'){
		func = deps;
		deps = [];
	}
	this.tasks[ name ] = {
		pre: deps,
		exports: func,
		status: Engine.STOP
	};
};

Engine.prototype.status = function(name){
	var task = this.tasks[ name ];
	if(!task){
		throw new Error('can not found task : ' + name);
	}
	return task.status;
};

Engine.prototype.run = function(name, callback){
	var engine = this;
	var task = engine.tasks[ name ];
	if(!task){
		throw new Error('can not found task : ' + name);
	}
	task.status = Engine.RUNNING;
	var preTask = [];
	task.pre.forEach(function(name){
		(function(name){
			preTask.push(function(cb){
				engine.run(name, cb);
			});
		})(name);
	});
	engine.async(preTask).series(function(err, results){
		task.exports(results, callback);
	});
};

Engine.prototype.filter = function(name, exports){
	this.filters[ name ] = exports;
};

Engine.prototype.filterAttribute = function(obj, attrs){
	if(!obj) return obj;
	var values = _.map(attrs, function(attr){
		return obj.hasOwnProperty(attr);
	});
	if(_.every(values)) return _.pick(obj, attrs);
};

Engine.prototype.request = function(options, callback){
	if(typeof options == 'string'){
		options = { url : options };
	}
	var baseUrl = this.config('api');
	var defaults = {
		method: 'GET'
	};
	options = _.extend(defaults, options);
	options.url = baseUrl + options.url;
	var jar = request.jar();
	var form = request({
		jar: jar,
		url: baseUrl + '/login',
		method: 'POST'
	}, function(err, res, body){
			if(err || !body  || res.statusCode != 200){
				return callback(new Error('login error', err));
			}
			options.jar = jar;
			var req = request(options, function(err, res, body){
				callback(err, (body && JSON.parse(body)) || body);
			});
			req.on('response', function(res){
				console.log('%s %s',options.method.green, options.url.gray);
				var length = parseInt(res.headers['content-length'], 10);
				if(length > (1 * (1024 * 1024)) ){
					var bar = new ProgressBar('[:bar] :percent :etas', {
						total: length
					});
					req.on('data', function(chunk){
						bar.tick(chunk.length);
					});
				}
			});
	}).form();

	form.append('username', 'admin1');
	form.append('password', 'xiaoshu815');
};


module.exports = function(options, callback){
	try{
		var engine = new Engine(options);
	}catch(e){
		throw e;
	}finally{
		engine.init(callback);
	}
};

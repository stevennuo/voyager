var _					= require('underscore');
var path 			= require('path');
var async 		= require('async');
var redis 		= require("redis");
var Promise		=	require('promise');
var CronJob 	= require('cron').CronJob;
var mongoose	= require('mongoose');

require('colors');

var Engine = function(options){
	this.tasks = {};
	//
	this.options = options;
	this.configs = options;
	// this.configs.baseUrl = 'http://yangcong345.com';
	this.configs.baseUrl = 'http://localhost:3000';
};

Engine.STATUS = {
	RUNNING	: 'RUNNING',
	STOP		: 'STOP'
};

Engine.prototype.init = function(callback){
	var engine = this;
	this.cache = redis.createClient();
	mongoose.connect('mongodb://localhost/teacher-dashboard', function(err, db){
		callback(engine);
	});
};

Engine.prototype.bootstrap = function(){
	this.load();
	require('./model');
	require('./config/crontab')(this);
};

Engine.prototype.model = function(name){
	return mongoose.model(name);
};

Engine.prototype.status = function(name){
	return this.tasks[ name ].status;
};

Engine.prototype.cron = function(crontab){
	var engine = this;
	for(var job in crontab){
		(function(key){
			var job = crontab[ key ];
			var cron = new CronJob(job, function(){
				if(engine.status(key) != Engine.STATUS.RUNNING){
					console.log('cron: %s starting ', key.green);
					engine.run(key);
				}else{
					//console.log('%s already running'.red, key);
				}
			}, engine.noop, true, '');
			cron.start();
		})(job);
	}
};

Engine.prototype.config = function(key, val){
	return this.configs[key];
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

Engine.prototype.noop = function(callback){

};

Engine.prototype.promise = function(callback){
	return new Promise(callback)
};

Engine.prototype._ = _;

Engine.prototype.run = function(name){
	var task = this.tasks[ name ];
	try{
		task.status = Engine.STATUS.RUNNING;
		task.exports(function(err, results){
			console.log('task: %s', name,  _.flatten(results).length);
			task.results = results;
			task.status = Engine.STATUS.STOP;
		});
	}catch(e){
		task.status = Engine.STATUS.ERROR;
	}finally{

	}
};

Engine.prototype.load = function(){
	var engine = this;
	engine.modules = [];
	engine.filters = {};
	var list =	['tasks/overview.js' ];
	list.forEach(function(filename){
		require('./' + filename)(engine);
	});

	var filters = [
		'AnswerProblem',
		'FinishLesson',
		'FinishProblemSet',
		'FinishVideo',
		'StartLesson',
		'StartProblemSet'
	];
	filters.forEach(function(filename){
		require('./filters/' + filename)(engine);
	});

};

Engine.prototype.task = function(name, func){
	this.tasks[ name ] = {
		exports: func,
		status: Engine.STATUS.STOP
	};
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


module.exports = function(options, callback){
	try{
		var engine = new Engine(options);
	}catch(e){
		throw e;
	}finally{
		engine.init(callback);
	}
};

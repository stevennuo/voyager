var fs          = require('fs');
var cron        = require('cron');
var path        = require('path');
var async       = require('async');
var redis       = require("redis");
var request     = require('request');
var Promise     = require('promise');
var mongoose    = require('mongoose');
var ProgressBar = require('progress');
var _           = require('underscore');

require('colors');
/**
 * [Engine 构造函数]
 * @param {[type]} options [description]
 */
var Engine = function(options){
  this.configs = _.extend({
    config  : './config/config',
    crontab : './config/crontab',
    tasks   : './tasks',
    filters : './filters'
  }, options);
  //expose underscore
  this._ = _;
  //root dir
  this.root = __dirname;
  //
  this.tasks = {};
  this.filters = {};
  this.crontab = {};
  //load modules
  this.load();
};

//define
([ 'running', 'stop', 'error' ]).forEach(function(status){
  Engine[ status.toUpperCase() ] = status;
});

/**
 * [init func]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Engine.prototype.init = function(callback){
  var engine = this;
  engine.cache = redis.createClient();
  mongoose.connect(engine.config('db'), function(err, db){
    require('./model');
    callback(engine);
  });
};
/**
 * [load load modules ]
 * @return {[type]} [description]
 */
Engine.prototype.load = function(){
  var engine = this;
  //load config file.
  require(engine.config('config'))(engine);
  //load crontab file.
  require(engine.config('crontab'))(engine);
  //load tasks
  fs.readdir(engine.config('tasks'), function(err, files){
    files.forEach(function(filename){
      console.log('loading task: %s', filename.red);
      require(path.join(engine.root,engine.config('tasks'), filename))(engine);
    });
  });
  //load filters.
  fs.readdir(engine.config('filters'), function(err, files){
    files.forEach(function(filename){
      console.log('loading filter: %s', filename.red);
      require(path.join(engine.root,engine.config('filters'), filename))(engine);
    });
  });
};
/**
 * [bootstrap 启动服务]
 * @return {[type]} [description]
 */
Engine.prototype.bootstrap = function(){
  //start up cron job.
  _.each(this.crontab, function(cronjob, name){
    cronjob.start();
  })
};
/**
 * [model description]
 * @param  {[type]} name [description]
 * @return {[type]}      [description]
 */
Engine.prototype.model = function(name){
  return mongoose.model(name);
};
/**
 * [cron 任务调度器]
 * @param  {[type]} crontab [description]
 * @return {[type]}         [description]
 */
Engine.prototype.cron = function(crontab){
  var engine = this;
  for(var job in crontab){
    (function(key){
      var job = crontab[ key ];
      var cronjob = new cron.CronJob(job, function(){
        if(engine.status(key) != Engine.RUNNING){
          console.log('cron: %s starting ', key.green);
          engine.run(key, function(){
            console.log('cron: %s over ', key);
          });
        }else{
          // console.log('%s already running'.red, key);
        }
      }, engine.noop, false, '');
      engine.crontab[ key ] = cronjob;
    })(job);
  }
};
/**
 * [config 配置管理]
 * @param  {[type]} key [description]
 * @param  {[type]} val [description]
 * @return {[type]}     [description]
 */
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
/**
 * [require 依赖管理]
 * @param  {[type]}   requirement_list [description]
 * @param  {Function} callback         [description]
 * @return {[type]}                    [description]
 */
Engine.prototype.require = function(requirement_list, callback){
  var engine = this;
  var requirements = [];
  requirement_list.forEach(function(requirement_name){
    requirements.push( require(path.join(engine.root, requirement_name))(engine) );
  });
  callback.apply(callback, requirements);
};
/**
 * [async 异步任务调度器]
 * @param  {[type]} tasks [description]
 * @return {[type]}       [description]
 */
Engine.prototype.async = function(tasks){
  var exports = {};
  ([ 'series', 'parallel' ]).forEach(function(method){
    (function(method){
      exports[ method ] = function(callback){
        async[ method ](tasks, callback)
      };
    })(method);
  });
  return exports;
};
/**
 * [noop description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Engine.prototype.noop = function(callback){};
/**
 * [promise 回调管理]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Engine.prototype.promise = function(callback){
  return new Promise(callback)
};
/**
 * [task description]
 * @param  {[type]} name [description]
 * @param  {[type]} deps [description]
 * @param  {[type]} func [description]
 * @return {[type]}      [description]
 */
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
/**
 * [run 执行任务]
 * @param  {[type]}   name     [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
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
/**
 * [filter 过滤器]
 * @param  {[type]} name    [description]
 * @param  {[type]} exports [description]
 * @return {[type]}         [description]
 */
Engine.prototype.filter = function(name, exports){
  this.filters[ name ] = exports;
};
/**
 * [filterAttribute 验证和过滤字段]
 * @param {[type]} obj   [description]
 * @param {[type]} attrs [description]
 */
Engine.prototype.filterAttribute = function(obj, attrs){
  if(!obj) return obj;
  var values = _.map(attrs, function(attr){
    return obj.hasOwnProperty(attr);
  });
  if(_.every(values)) return _.pick(obj, attrs);
};
/**
 * [request 请求网络资源]
 * @param  {[type]}   options  [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
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
  //login require
  form.append('username', this.config('username'));
  form.append('password', this.config('password'));
};
/**
 * [exports 初始化]
 * @param  {[type]}   options  [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
module.exports = function(options, callback){
  try{
    var engine = new Engine(options);
  }catch(e){
    throw e;
  }finally{
    engine.init(callback);
  }
};

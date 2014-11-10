var request = require('request');
var ProgressBar = require('progress');

module.exports = function(engine){
	var baseUrl = engine.config('baseUrl');
	return function(options, callback){
		var defaults = {
			method: 'GET'
		};
		for(var key in options){
			defaults[ key ] = options[ key ];
		}
		options = defaults;
		options.url = baseUrl + options.url;
		var jar = request.jar();
		var form = request({
			jar: jar,
			url: baseUrl + '/login',
			method: 'POST'
		}, function(err, res, body){
				if(err || !body  || res.statusCode != 200){
					callback(new Error('login error', err));
				}
				options.jar = jar;
				var req = request(options, function(err, res, body){
					if(err){
						callback(err);
					}else{
						try{
							callback(err, JSON.parse(body));
						}catch(e){
							callback(e);
						}
					}
				});
				req.on('response', function(res){
					console.log('%s %s',options.method.green, options.url.gray);
					var length = parseInt(res.headers['content-length'], 10);
					if(length > (1024 * 1024)){
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
};

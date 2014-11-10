
module.exports = function(engine){
	engine.task('overview', function(done){
		engine.require([
			'libs/request'
		], function(request){
			var _ = engine._;
			/**
			 * [syncUser sync users to redis cache]
			 * @param {Function} callback [description]
			 */
			var syncUser = function(callback){
				engine.cache.get('sync-user-date', function(err, reply){
					var last = parseInt(reply, 10);
					if( (new Date) - (new Date(last)) > (100000) ){
						request({ url: '/users' }, function(err, users){
							var users = _.map(users, function(user){
								return _.pick(user, [ '_id', 'username' ]);
							});
							var pushRedis = [];
							_.each(users, function(user){
								pushRedis.push(function(cb){
									engine.cache.set('user:' + user.username, user._id, function(err, reply){
										//console.log('SET user:%s as %s, %s', user.username, user._id, reply);
										cb(err, user);
									});
								});
							});
							engine.async(pushRedis).series(callback);
							engine.cache.set('sync-user-date', +new Date);
						});
					}else{
						callback(null, []);
					}
				});
			};
			/**
			 * [getTracksCount description]
			 * @param {Function} callback [description]
			 */
			var getTracksCount = function(callback){
				request({ url : '/tracks/count'}, function(err, result){
					if(err) callback(err);
					engine.cache.get('last', function(err, reply){
						callback(err, { count: result.count, last: parseInt(reply, 10) });
					});
				});
			};

			var getCourse = function(callback){
				request({url:'/api/v1/courses'}, function(err, courses){
					//console.log(courses);
					callback(err, courses);
				});
			}


			var process = function(tracks, callback){
				var statusInfo = [
					"distinct_id",
					"eventKey",
					"ChapterId",
					"LessonId",
					"timestamp",
					"isReview", //
					"Rate",
					"Random",
					"Blood",
					"Size",
					"CurrentTime",//
					"VideoDuration",//
					"SkipOrNot",//
					"Correct",//
					"Thinktime",
					"Answer",//
					"WrongCount",
					"AnswerOrNot",
					"CheckExplanationOrNot",//
					"CorrectCount",//
					"CorrectPercent",//
					"AnswerTime",//
					"Pass",//
					"PassOrNot"//
				];
				tracks = _.filter(tracks, function(track){
					return track.data.properties.usergroup == 'student' ||
								track.data.properties.roles == 'student';
				});

				tracks = _.map(tracks, function(track){
					track.data.properties.eventKey = track.data.event;
					track.data.properties.timestamp = track.timestamp;
					return _.pick(track.data.properties, statusInfo);
				});

				var getUserIdGroup = [];
				tracks.forEach(function(track){
					getUserIdGroup.push(function(callback){
						track.user_id = engine.cache.get('user:'+ track.distinct_id, function(err, reply){
							//console.log(track.distinct_id, reply);
							track.user_id = reply;
							callback(err, track);
						});
					});
				});

				var Record = engine.model('record');

				engine.async(getUserIdGroup).parallel(function(err, results){

					var pushTrack = [];

					results.forEach(function(track){
						pushTrack.push(function(cb){
							(function(t){
								var time = +new Date(t.timestamp);
								Record.findOneOrCreate(track.user_id, function(err, record){
									var stats = record.stats || {};
									stats = JSON.parse( JSON.stringify(stats) ); //fix mongoose bugs.
									stats[ t.eventKey ] = stats[ t.eventKey ] || {};
									stats[ t.eventKey ][ time ] = t;
									record.stats = stats;

									record.save(cb);
								});
							})(track);
						});
					});

					engine.async(pushTrack).series(callback);
				});

			};
			/**
			 * [getAllTracks description]
			 * @param {[type]} options [description]
			 */
			var getAllTracks = function(options){
					// var SIZE = 30000;
					var SIZE = 5000;
					var LAST = options.last || 0;
					var COUNT= options.count || 0;
					var requestQueue = [];
					engine.cache.set('last', COUNT);
					var query = '/tracks?skip=$skip&limit=$limit';
					for(var i=LAST;i<COUNT;i+= SIZE){
						(function(url){
							requestQueue.push(function(callback){
								request({ url : url	}, function(err, tracks){
									process(tracks, callback);
								});
							});
						})(query.replace('$skip', i).replace('$limit', SIZE));
					}
					engine.async(requestQueue).series(done);
			};

			engine.async([
				syncUser,
				//getCourse,
				getTracksCount
			]).series(function(err, results){
				getAllTracks(_.last(results))
			});
		});
	});
};

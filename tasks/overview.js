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
										console.log('SET user:%s as %s, %s', user.username, user._id, reply);
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

			var syncRoom = function(callback){
				request({ url: '/rooms' }, function(err, rooms){
					var a = {};
					_.each(rooms, function(room){
						a[ room._id ] = room.students;
					});
					_.each(a, function(students, roomId){
						students.forEach(function(studentId){
							engine.cache.hset('room:' + roomId, studentId,'', engine.noop);
						});
					});
					callback(err, null);
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

			var syncCourse = function(callback){

				request({url:'/api/v1/courses'}, function(err, courses){
					if(err) return console.error(err);
					courses.forEach(function(chapter){
						chapter.layers.forEach(function(layer){
							layer.lessons.forEach(function(lesson){
								engine.cache.hset('chapter:' + chapter._id, 'lesson:' + lesson._id, JSON.stringify(lesson), function(){

								});
							});
							//
						});
					});
					callback(err, null);
				});
			}

			/**
			 * [getAllTracks description]
			 * @param {[type]} options [description]
			 */
			var getAllTracks = function(options){
					var SIZE = 500;
					var LAST = options.last || 0;
					var COUNT= options.count || 0;
					var requestQueue = [];
					var query = '/tracks?skip=$skip&limit=$limit';
					for(var i=LAST;i<COUNT;i+= SIZE){
						(function(url){
							requestQueue.push(function(callback){
								request({ url : url	}, function(err, tracks){
									//过滤 student
									tracks = _.filter(tracks, function(track){
										var properties = engine.filterAttribute(track.data.properties, [
											'roles',
											'usergroup'
										]);

										if(properties){
											return properties.roles 		== 'student' ||
														properties.usergroup 	== 'student';
										}
									});

									//过滤事件
									var filterGroup = [];
									tracks.forEach(function(track){
										filterGroup.push(function(callback){
											(function(track, cb){
												var timestamp = track.timestamp;
												var eventKey = track.data.event;
												var track = track.data.properties;
												var username = track.distinct_id;
												track.timestamp = timestamp;
												//交给事件过滤器处理
												if(username && eventKey && engine.filters[ eventKey ]){
													engine.filters[ eventKey ](track, function(err, result){
														if(!err && result){
															engine.cache.get('user:'+ username, function(err, userId){
																if(err || !userId){//无效 user， 忽略
																	cb('can not found user id for ' + username, null);
																}else{
																	cb(null, {
																		userId: userId,
																		track: result,
																		eventKey: eventKey
																	});
																}
															});
														}else{//数据无效，忽略
															cb(err, null);
														}
													});
												}else{//无事件处理器，忽略
													cb(null, null);
												}
											})(track, callback);
										});
									});

									//开始执行 [事件过滤] 异步任务
									engine.async(filterGroup).parallel(function(err, results){
										if(err) console.log(err)
										var tracks = _.compact(results);
										var pushTrack = [];
										var Record = engine.model('record');
										//存储数据
										tracks.forEach(function(track){
											pushTrack.push(function(cb){
												(function(track){
													Record.findOneOrCreate(track.userId, function(err, record){
														var stats = record.stats || {};
														stats = JSON.parse( JSON.stringify(stats) ); //fix mongoose bugs.
														stats[ track.eventKey ] = stats[ track.eventKey ] || [];
														//already contains ..
														if(!_.findWhere(stats[ track.eventKey ], track.timestamp)){
															stats[ track.eventKey ].push(track.track);
														}
														record.stats = stats;
														record.save(function(err, r){
															cb(err, null);//这里没有返回 ‘r’
														});

													});
												})(track);
											});
										});
										//开始执行存储任务
										engine.async(pushTrack).series(callback);
									});
									engine.cache.set('last', i);
								});
							});
						})(query.replace('$skip', i).replace('$limit', SIZE));
					}
					engine.async(requestQueue).series(done);
			};

			engine.async([
				syncUser,
				syncRoom,
				syncCourse,
				getTracksCount
			]).series(function(err, results){
				if(err) {
					console.log(err);
				}else{
					getAllTracks(_.last(results))
				}
			});
		});
	});
};

module.exports = function(engine){
  engine.task('getAllTracks', [
    'syncUser',
    'syncRoom',
    'syncCourse'
  ],function(options, done){
    var _ = engine._;
    //
    var preTask = [];
    /**
     * [getCount 获取当前 Tracks 数量]
     * @param
     */
    preTask.push(function getCount(callback){
      engine.request('/tracks/count', function(err, result){
        console.log('count: %j', result.count);
        callback(err, result.count);
      });
    });
    /**
     * [getLast 获取最后一次执行成功的位置]
     * @param
     */
    preTask.push(function getLast(callback){
      engine.cache.get('last', function(err, result){
        console.log('last: ', result);
        callback(err, parseInt(result));
      });
    });
    /**
     * [filterByStudent 过滤 student ]
     * @param {[type]} tracks [description]
     */
    var filterByStudent = function(tracks){
      return _.filter(tracks, function(track){
        var properties = engine.filterAttribute(track.data.properties, [
          'roles',
          'usergroup'
        ]);

        if(properties){
          return properties.roles 		== 'student' ||
                properties.usergroup 	== 'student';
        }
      });
    };
    /**
     * [filterTracks 事件过滤器]
     * @param {[type]}   tracks   [description]
     * @param {Function} callback [description]
     */
    var filterTracks = function(tracks, callback){
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
        callback(err, _.compact(results));
      });
    };
    /**
     * [storeTracks 存储]
     * @param {[type]}   tracks   [description]
     * @param {Function} callback [description]
     */
    var storeTracks = function(tracks, callback){
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
    };
    /**
     * [processTracks 任务处理函数]
     * @param {[type]}   tracks   [description]
     * @param {Function} callback [description]
     */
    var processTracks = function(tracks, callback){
      filterTracks(filterByStudent(tracks), function(err, tracks){
        storeTracks(tracks, callback);
      });
    };
    /**
     * [generateTask 任务生成器]
     * @param {[type]} size  [description]
     * @param {[type]} count [description]
     * @param {[type]} last  [description]
     */
    var generateTask = function(size, count, last){
      var requestQueue = [];
      var query = '/tracks?skip=$skip&limit=$limit';
      for(var i=last;i<count;i+= size){
        (function(url, current){
          requestQueue.push(function(callback){
            engine.request(url, function(err, tracks){
              processTracks(tracks, function(err, results){
                engine.cache.set('last', current, function(err, reply){
                  callback(err, results);
                });
              });
            });
          });
        })(query.replace('$skip', i).replace('$limit', size), i);
      }
      //开始请求数据
      engine.async(requestQueue).series(function(err, results){
        engine.cache.set('last', count, done);
      });
    };
    /**
     * [description]
     * @param  {[type]} err       [description]
     * @param  {[type]}
     * @return {[type]}           [description]
     */
    engine.async(preTask).parallel(function(err, results){
      var size = engine.config('per-request-length') || 1000;
      var count = _.first(results) || 0;
      var last  = _.last(results)  || 0;
      generateTask(size, count, last);
    });
  });
};

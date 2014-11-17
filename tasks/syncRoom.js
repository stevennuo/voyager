/**
 * [exports 同步 [班级] 数据 ]
 * @param  {[type]} engine [description]
 * @return {[type]}        [description]
 */
module.exports = function(engine){
  engine.task('syncRoom', function(options, done){
    engine.request('/rooms', function(err, rooms){
      var _ = engine._;
      var groupByRoomId = {};
      _.each(rooms, function(room){
        groupByRoomId[ room._id ] = room.students;
      });
      var roomTaskGroup = [];
      _.each(groupByRoomId, function(students, roomId){
        roomTaskGroup.push(function(callback){
          (function(roomId, students){
            var studentTaskGroup = [];
            students.forEach(function(studentId){
              studentTaskGroup.push(function(callback){
                engine.cache.hset('room:' + roomId, studentId, '', callback);
              });
            });
            engine.async(studentTaskGroup).parallel(callback);;
          })(roomId, students);
        });
      });
      engine.async(roomTaskGroup).parallel(function(err, results){
        done(err, groupByRoomId);
      });
    });
  });
};

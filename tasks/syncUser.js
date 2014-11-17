/**
 * [sync user info to redis]
 * @param  {[type]} engine [description]
 * @return {[type]}        [description]
 */
module.exports = function(engine){
  engine.task('syncUser', function(options, done){
    engine.request('/users', function(err, users){
      var _ = engine._;
      var users = _.map(users, function(user){
        return _.pick(user, [ '_id', 'username' ]);
      });
      var taskGroup = [];
      _.each(users, function(user){
        taskGroup.push(function(cb){
          engine.cache.set('user:' + user.username, user._id, function(err, reply){
            cb(err, user);
          });
        });
      });
      engine.async(taskGroup).parallel(done);
    });
  });
};

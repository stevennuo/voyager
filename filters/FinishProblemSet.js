module.exports = function(engine){
  var _ = engine._;
  engine.filter('FinishProblemSet', function(track, callback){
    var t = engine.filterAttribute(track, [
      'timestamp',
      'ChapterId',
      'LessonId',
      'ActivityId',
      'CorrectCount',
      'isReview'
    ] ); //require 'problemSize'
    if(t){
      engine.cache.hget('chapter:' + t.ChapterId, 'lesson:' + t.LessonId, function(err, str){
        var lesson = JSON.parse(str);
        if(!lesson) return callback('lesson is null');
        var activity = _.findWhere(lesson.activities, { _id: t.ActivityId });
        if(activity && ~[ 'gonggu', 'lianxi' ].indexOf(activity.type)){
          t.ProblemSize = activity.pool_count || activity.problems.length;
          callback(err, t);
        }else{
          callback('activity 无效');
        }
      });
    }else{
      callback(t);
    }
  });
};

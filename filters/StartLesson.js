module.exports = function(engine){
  engine.filter('StartLesson', function(track, callback){
    callback(null, engine.filterAttribute(track, [
      'timestamp',
      'ChapterId',
      'LessonId',
      'isReview' ]));
  });
};

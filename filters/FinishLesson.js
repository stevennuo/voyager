module.exports = function(engine){
  engine.filter('FinishLesson', function(track, callback){
    callback(null, engine.filterAttribute(track, [
      'ChapterId' ,
      'LessonId',
      'timestamp',
      'isReview',
      'PassOrNot'
    ]));
  });
};

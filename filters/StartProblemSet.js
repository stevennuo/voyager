module.exports = function(engine){
  engine.filter('StartProblemSet', function(track, callback){
    callback(null, engine.filterAttribute(track, [
      'timestamp',
      'ChapterId',
      'LessonId',
      'Random',
      'Blood',
      'Size',
      'isReview' ] ));
  });
};

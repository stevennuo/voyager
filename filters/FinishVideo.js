module.exports = function(engine){
  engine.filter('FinishVideo', function(track, callback){
    callback(null, engine.filterAttribute(track, [
      'timestamp',
      'ChapterId',
      'LessonId',
      'CurrentTime',
      'VideoDuration',
      'isReview' ] ));
  });
};

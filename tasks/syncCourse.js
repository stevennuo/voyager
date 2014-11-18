/**
 * [exports 同步 Course 数据]
 * @param  {[type]} engine [description]
 * @return {[type]}        [description]
 */
module.exports = function(engine){
  var _ = engine._;
  engine.task('syncCourse', function(options, done){
    engine.request('/api/v1/courses', function(err, courses){
      console.log(err,courses);
      /**
       * [chapterify description]
       * @type {Object}
       * {
       * 		chapterId: {
       * 			lessonId: lesson,
       * 			....
       * 			lessonId: lesson
       * 			....
       * 		},
       * 		....
       * }
       */
      var chapterify = {};
      courses.forEach(function(chapter){
        chapterify[ chapter._id ] = {};
        chapter.layers.forEach(function(layer){
          layer.lessons.forEach(function(lesson){
            chapterify[ chapter._id ][ lesson._id ] = lesson;
          });
        });
      });

      var chapterTaskGroup = [];
      _.each(chapterify,function(lessons, chapterId){
        chapterTaskGroup.push(function(callback){
          var lessonTaskGroup = [];
          _.each(lessons,function(lesson){
            lessonTaskGroup.push(function(callback){
              engine.cache.hset('chapter:' + chapterId, 'lesson:' + lesson._id, JSON.stringify(lesson), callback);
            });
          });
          engine.async(lessonTaskGroup).parallel(callback);
        });
      });
      engine.async(chapterTaskGroup).parallel(function(err, results){
        done(err, chapterify);
      });
    });
  });
};


var mongoose = require('mongoose');

var RecordSchema = new mongoose.Schema({
  chapter_id  : String, // TODO: -> chapterId
  lesson_id	  : String, // TODO: -> lessonId
  user_id     : String, // TODO: -> userId
  stats       : {  }
});

RecordSchema.statics.findOneOrCreate = function(user, callback){
  var stats, where = { user_id: user };
  // TODO: 用mongoose原生函数, 下面代码就用一行
  // TODO: findOneAndUpdate(where, {$set:where}, {upsert:true}, callback);
  this.findOne(where, function(err, record){
    if(!record){
      var Record = mongoose.model('record');
      record = new Record(where);
    }
    callback(err, record);
  });

};

mongoose.model('record', RecordSchema);

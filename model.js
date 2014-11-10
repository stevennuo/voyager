
var mongoose = require('mongoose');

var RecordSchema = new mongoose.Schema({
  chapter_id  : String,
  lesson_id	  : String,
  user_id     : String,
  stats       : {  }
});

RecordSchema.statics.findOneOrCreate = function(user, callback){
  var stats, where = { user_id: user };
  this.findOne(where, function(err, record){
    if(!record){
      var Record = mongoose.model('record');
      record = new Record(where);
    }
    callback(err, record);
  });

};

mongoose.model('record', RecordSchema);

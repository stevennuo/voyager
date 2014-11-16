var express = require('express');
var logger	=	require('express-log');
var _				=	require('underscore');

var redis		=	require('redis');
var mongodb = require('mongodb');

var async 	=	require('async');

var cache 	= redis.createClient();
var client 	= mongodb.MongoClient;

var app = express();

app.use(logger());

_.mixin({
	// Return a copy of the object containing all but the blacklisted properties.
	unpick: function (obj) {
		return _.pick(obj, _.difference(_.keys(obj), _.flatten(Array.prototype.slice.call(arguments, 1))));
	}
});

/**
 * [toChapterify 将某个 User 的 Tracks 数据按照 ChapterId 分组]
 * @param  {[type]} user [description]
 * @return {[type]}      [description]
 */
var toChapterify = function(user){
	var chapterify = {};
	//group by chapterId
	for(var eventKey in user.stats){
		var tracks = user.stats[ eventKey ];
		tracks.forEach(function(track){
			chapterify[ track.ChapterId ] = chapterify[ track.ChapterId ] || {};
			chapterify[ track.ChapterId ][ track.LessonId ] = chapterify[ track.ChapterId ][ track.LessonId ] || {};
			chapterify[ track.ChapterId ][ track.LessonId ][ eventKey ] = chapterify[ track.ChapterId ][ track.LessonId ][ eventKey ] || [];
			chapterify[ track.ChapterId ][ track.LessonId ][ eventKey ].push(_.unpick(track, 'LessonId', 'ChapterId' ));
		});
	}
	return chapterify;
};

var individuals = function(chapterId, roomId, callback){
	var db = app.get('db');
	var Record = db.collection('records');
	cache.hkeys('room:' + roomId, function(err, students){
		var taskGroup = [];
		students.forEach(function(userId){
			taskGroup.push(function(callback){
				Record.findOne({ 'user_id': userId }, function(err, user){
					var stat;
					if(!err && user){
						var chapterify = toChapterify(user);
						if(chapterify[ chapterId ]) {
							stat = {
								userId: userId,
								stats: (chapterify[ chapterId ])
							};
						}
					}
					callback(err, stat);
				});
			});
		});
		async.parallel(taskGroup, function(err, results){
			callback(err, _.compact(results));
		});

	});
};


app.get('/stats/individuals', function(req, res){
	var chapterId = req.query['chapterId'];
	var roomId 		= req.query['roomId'];
	individuals(chapterId, roomId, function(err, results){
		res.send(results);
	});
});

app.get('/stats/rooms', function(req, res){
	var chapterId = req.query['chapterId'];
	var roomId 		= req.query['roomId'];
	individuals(chapterId, roomId, function(err, results){
		var lessonify = {};
		results.forEach(function(user){
			for(var lessonId in user.stats){
				lessonify[ lessonId ] = lessonify[ lessonId ] || {};
				var stats = user.stats[lessonId];
				for(var eventKey in stats){
					var tracks = stats[ eventKey ];
					lessonify[ lessonId ][ eventKey ] = lessonify[ lessonId ][ eventKey ] || [];
					tracks.forEach(function(track){
						track.userId = user.userId;
						lessonify[ lessonId ][ eventKey ].push(track);
					});
				}
			}
		});
		res.send(lessonify);
	});
});


client.connect('mongodb://localhost/teacher-dashboard', function(err, db){
	app.listen(3002);
	app.set('db', db);
});

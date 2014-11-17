module.exports = function(engine){
	engine.cron({
		// syncUser		: '* * * * * *',
		// syncRoom		: '* * * * * *',
		// syncCourse	: '* * * * * *',
		getAllTracks: '* * * * * *'
	});
};

module.exports = function(engine){
  engine.config(function(env){
    return ({
      development: {
        api:  'http://localhost:3000',
        db:   'mongodb://localhost/teacher-dashboard'
      },
      production: {
        api:  'http://yangcong345.com',
        db:   'mongodb://localhost/teacher-dashboard'
      }
    })[ env ];
  });
};

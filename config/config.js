module.exports = function(engine){
  engine.config(function(env){
    return ({
      development: {
        api:  'http://localhost:3000',
        db:   'mongodb://localhost/teacher-dashboard',
        username: 'admin1',
        password: 'xiaoshu815'
      },
      production: {
        api:  'http://yangcong345.com',
        db:   'mongodb://localhost/teacher-dashboard',
        username: 'admin1',
        password: 'xiaoshu815'
      }
    })[ env ];
  });
};

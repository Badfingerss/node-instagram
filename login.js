const nodeInstagram = require('./lib/instagram');
const read = require('read');
 
read({prompt: 'Username: '}, (err, username) => {
  read({prompt: 'Password: ', silent: true}, (err, password) => {
    nodeInstagram
      .login(username, password)
      .then(output => {
        console.log(output);
      })
      .catch(err => {
        console.log(err);
      });
  });
});

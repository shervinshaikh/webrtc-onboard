var express = require('express');
var fs = require('fs');
var app = express();

var options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
  requestCert: false,
  rejectUnauthorized: false
};
var server = require('https').Server(options, app);

app.set('port', (process.env.PORT || 5000));

// Serve static files from directory
app.use(express.static(__dirname + "/public"));

app.get('/', function (req, res){
  res.sendFile(__dirname + '/index.html');
});

server.listen(app.get('port'), function(){
  console.log("Listening on:", app.get('port'));
});
var express = require('express');
var app = express();
// var bodyParser = require("body-parser");
// var errorHandler = require("errorhandler");
var server = require('http').Server(app);
// var io = require('socket.io')(server);

app.set('port', (process.env.PORT || 5000));

// Serve static files from directory
app.use(express.static(__dirname + "/public"));
// app.use(express.static(__dirname + "/node_modules"));

// Simple logger
// app.use(function(req, res, next){
//   console.log("%s %s", req.method, req.url);
//   console.log(req.body);
//   next();
// });

// Error handler
// app.use(errorHandler({
//   dumpExceptions: true,
//   showStack: true
// }));

app.get('/', function (req, res){
  res.sendFile(__dirname + '/index.html');
});

// io.on('connection', function(socket){
//   console.log('a user connected');
// });

server.listen(app.get('port'), function(){
  console.log("Listening on:", app.get('port'));
});
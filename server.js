var app = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);

var PORT = 3000;

app.get('/', function (req, res){
  res.sendFile('index.html');
});

io.on('connection', function(socket){
  console.log('a user connected');
});

http.listen(PORT, function(){
  console.log("Listening on:", PORT);
});
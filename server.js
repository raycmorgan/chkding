var http    = require('http'),
    connect = require('connect'),
    app = connect.createServer(),
    io  = require('socket.io').listen(app),
    fs  = require('fs');

app.use(connect.static(__dirname + '/static'));
app.listen(process.env.NODE_PORT || 8888);

USERS = {};
GAMES = {};

io.sockets.on('connection', function (socket) {
  USERS[socket.id] = socket;
  socket.game = null;
  
  socket.on('name', function (name) {
    socket.name = name;
    socket.emit('ack-name', socket.id);
  });
  
  socket.on('join', function (data) {
    GAMES[data.gameName].addUser(socket);
  });
  
  socket.on('disconnect', function () {
    if (socket.game) {
      GAMES[socket.game].removeUser(socket);
    }
  });
});


// Require games
require('./games/price_guess');

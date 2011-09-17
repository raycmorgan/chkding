var getRandomShit = require('../util').getRandomShit;

var STEP_TIME = 5000;

var game = GAMES['price-guess'] = {
  users    : [],
  shortUsers : [],
  name     : 'price-guess',
  state    : 'creating',
  lastLoop : (new Date).getTime(),
  round    : {},
  
  addUser: function (user) {
    console.log('PriceGame - new user: ' + user.id);
    
    user.game = game.name;
    game.users.push(user);
    game.shortUsers.push({id: user.id, name: user.name || "anon"});
    
    broadcast('user-join', user.id);
    
    user.emit('users', game.shortUsers);
    user.emit('round', game.round);
    
    user.on('guess', function (amount) {
      amount = amount.replace(/[$, ]|\.\d*$/g, '');
      
      var position = userRoundPosition(user.id);
      
      if (position != -1) {
        game.round.stepGuesses[position] = amount;
        broadcast('guess', {user: user.id, roundPosition: position, guess: amount});
      } else {
        broadcast('shout', {user: user.id, message: amount});
      }
    });
    
    user.on('shout', function (msg) {
      broadcast('shout', {user: user.id, message: msg});
    });
  },
  
  removeUser: function (user) {
    user.game  = null;
    
    for (var i = 0; i < game.users.length; i++) {
      if (user.id == game.users.id) {
        game.users.splice(i, 1);
        break;
      }
    }
    
    if (game.round.users && game.round.users.indexOf(user.id) != -1) {
      game.round.removedUser.push(user.id);
      if (game.round.users.length - game.round.removedUser.length < 2) {
        changeStateTo('creating');
      }
    }
    
    broadcast('user-left', user.id);
  }
};

function loop() {
  
  var now = (new Date).getTime();
  
  switch (game.state) {
    case 'creating':
      if (game.creating) break;
    
      if (game.users.length > 1) {
        game.creating = true;
        startNewGame();
      } else {
        changeStateTo('waiting');
      }
      
      break;
    
    case 'waiting':
      if (game.users.length > 1) {
        changeStateTo('creating');
      }
      
      break;
      
    case 'starting-game':
      if (now - game.round.createdAt > 5000) {
        game.round.start = now;
        changeStateTo('in-game');
      }
      
      break;
      
    case 'in-game':
      if (now - game.round.lastMove > 20000) {
        changeStateTo('creating');
      } else {
        gameTick(now);
      }
      
      break;
    
    case 'game-end':
      game.endTime = now;
      changeStateTo('post-game');
      
      broadcast('winners', game.round.winners);
      break;
    
    case 'post-game':
      if (now - game.endTime > 10000) {
        changeStateTo('creating');
      }
      
      break;
  }
  
  
  game.lastLoop = (new Date).getTime();
}

startNewGame.failCount = 0;
function startNewGame() {
  getRandomShit(function (err, items) {
    if (err) {
      console.log('[ERROR] Error fetching STP api...');
      console.log(err);
      
      /*
      if (++startNewGame.failCount < 4) {
        setTimeout(startNewGame, 5000);
      }
      */
      
      return;
    }
    
    var users = getUsers(4);
    var ids   = users.map(function (u) { return u.id; });
    var names = users.map(function (u) { return u.name; });
    
    game.round = {
      users: ids,
      userNames: names,
      removedUser: [],
      createdAt: (new Date).getTime(),
      step : 0,
      positions: [0, 0, 0, 0],
      stepGuesses: [0, 0, 0, 0],
      lastMove: (new Date).getTime()
    };
    
    broadcast('round', game.round);
    
    game.round.items = items;
    
    changeStateTo('starting-game');
    
    game.creating = false;
  });
}

function gameTick(now) {
  var step = Math.ceil((now - game.round.start) / STEP_TIME);
  
  if (game.round.step != step) {
    
    if (game.round.step > 0) {
      // Finalize last step
      var actual = game.round.currentItem.price;

      updatePositionsFromGuess(actual);
      
      broadcast('new-positions', game.round.positions);
      
      var winners = gatherWinners();
      
      if (winners.length > 0) {
        game.round.winners = winners;
        changeStateTo('game-end');
      }
    }
    
    // Setup next step
    game.round.step = step;
    game.round.stepGuesses = [0, 0, 0, 0];
    game.round.currentItem = game.round.items[step % game.round.items.length];
    
    broadcast('next-item', game.round.currentItem);
  }
}

function changeStateTo(newState) {
  console.log('Changing game state to: ' + newState);
  
  game.state = newState;
  broadcast('state', newState);
}

function broadcast(type, msg) {
  for (var i = 0; i < game.users.length; i++) {
    game.users[i].emit(type, msg);
  }
}

function userRoundPosition(user) {
  for (var i = 0; i < game.round.users.length; i++) {
    if (user == game.round.users[i]) {
      return i;
    }
  }
  
  return -1;
}

function getUsers(num) {
  if (game.users.length <= num) {
    return game.users.map(function (user) {
      return {id: user.id, name: user.name || "anon"};
    });
  }
  
  fisherYates(game.users);
  var users = [game.users[0], game.users[1], game.users[2], game.users[3]];
  
  return users.map(function (user) {
    return {id: user.id, name: user.name || "anon"};
  });
}

function fisherYates(myArray) {
  var i = myArray.length;
  if (i == 0) return false;
  
  while (--i) {
     var j = Math.floor(Math.random() * (i + 1));
     var tempi = myArray[i];
     var tempj = myArray[j];
     myArray[i] = tempj;
     myArray[j] = tempi;
   }
}

function updatePositionsFromGuess(actual) {
  game.round.stepGuesses.forEach(function (guess, i) {
    if (guess == 0) {
      return;
    } 
    
    game.round.lastMove = (new Date).getTime();
    
    var delta = Math.abs(guess - actual);
    var positions = game.round.positions;
    
    if (delta < 1) {
      positions[i] += .5;
    } else if (delta < 15) {
      positions[i] += .3;
    } else if (delta < 25) {
      positions[i] += .2;
    } else if (delta < 30) {
      positions[i] += .18;
    } else if (delta < 35) {
      positions[i] += .17;
    } else if (delta < 40) {
      positions[i] += .16;
    } else if (delta < 50) {
      positions[i] += .15;
    } else if (delta < 100) {
      positions[i] += .1;
    } else if (delta < 200) {
      positions[i] += .05;
    } else {
      positions[i] += .01;
    }
  });
}

function gatherWinners() {
  var winners = [];
  game.round.positions.forEach(function (position, i) {
    if (position >= 1) {
      winners.push(game.round.users[i]);
    }
  });
  return winners;
}

setInterval(loop, 1000);

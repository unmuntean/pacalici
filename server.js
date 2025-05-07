const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const games = {};
const userRooms = {};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Create a new game room
  socket.on('createGame', (username) => {
    const roomId = generateRoomId();
    
    // Initialize game state
    games[roomId] = {
      players: [{
        id: socket.id,
        username: username,
        cards: [],
        pairs: 0
      }],
      deck: [],
      status: 'waiting',
      currentTurn: 0,
      winner: null,
      loser: null
    };
    
    // Associate this socket with the room
    userRooms[socket.id] = roomId;
    
    socket.join(roomId);
    socket.emit('gameCreated', { roomId, playerId: socket.id });
    
    console.log(`Game created: ${roomId} by ${username}`);
  });

  // Join an existing game
  socket.on('joinGame', ({ roomId, username }) => {
    const game = games[roomId];
    
    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }
    
    if (game.status !== 'waiting') {
      socket.emit('error', 'Game already started');
      return;
    }
    
    if (game.players.length >= 6) {
      socket.emit('error', 'Game is full (max 6 players)');
      return;
    }
    
    // Add player to the game
    game.players.push({
      id: socket.id,
      username: username,
      cards: [],
      pairs: 0
    });
    
    userRooms[socket.id] = roomId;
    socket.join(roomId);
    
    // Notify all players in the room
    io.to(roomId).emit('playerJoined', {
      id: socket.id,
      username: username,
      playerCount: game.players.length
    });
    
    // Send current players to the new player
    socket.emit('gameJoined', {
      roomId,
      playerId: socket.id,
      players: game.players.map(p => ({ id: p.id, username: p.username, pairs: p.pairs }))
    });
    
    console.log(`Player ${username} joined game: ${roomId}`);
  });

  // Start the game
  socket.on('startGame', () => {
    const roomId = userRooms[socket.id];
    if (!roomId || !games[roomId]) return;
    
    const game = games[roomId];
    
    // Need at least 2 players
    if (game.players.length < 2) {
      socket.emit('error', 'Need at least 2 players to start');
      return;
    }
    
    // Initialize the deck
    game.deck = createDeck();
    game.status = 'playing';
    
    // Deal cards
    const remainingCards = dealCards(game);
    
    // Notify all players that the game has started
    io.to(roomId).emit('gameStarted', {
      currentTurn: game.players[game.currentTurn].id,
      deckCount: remainingCards
    });
    
    // Send each player their cards
    game.players.forEach(player => {
      io.to(player.id).emit('dealtCards', {
        cards: player.cards
      });
    });
    
    console.log(`Game ${roomId} started with ${game.players.length} players, deck remaining: ${remainingCards}`);
  });

  // Player declaring a pair
  socket.on('declarePair', ({ card1, card2 }) => {
    const roomId = userRooms[socket.id];
    if (!roomId || !games[roomId]) return;
    
    const game = games[roomId];
    
    // Check if it's the player's turn
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1 || game.currentTurn !== playerIndex) {
      socket.emit('error', 'Not your turn');
      return;
    }
    
    const player = game.players[playerIndex];
    
    // Verify that the player has these cards
    const cardIndex1 = player.cards.findIndex(c => c.id === card1.id);
    const cardIndex2 = player.cards.findIndex(c => c.id === card2.id);
    
    if (cardIndex1 === -1 || cardIndex2 === -1) {
      socket.emit('error', 'You do not have these cards');
      return;
    }
    
    // Check if the cards form a valid pair
    if (isPair(player.cards[cardIndex1], player.cards[cardIndex2])) {
      // Remove the cards from the player's hand
      const removedCards = [
        player.cards.splice(cardIndex1, 1)[0],
        player.cards.splice(cardIndex2 > cardIndex1 ? cardIndex2 - 1 : cardIndex2, 1)[0]
      ];
      
      // Increase pair count
      player.pairs += 1;
      
      // Notify all players about the pair
      io.to(roomId).emit('pairDeclared', {
        playerId: socket.id,
        cards: removedCards,
        remainingCardCount: player.cards.length,
        pairs: player.pairs
      });
      
      // Check if the player has won (no more cards)
      if (player.cards.length === 0) {
        if (game.deck.length > 0) {
          // Draw a card if there are still cards in the deck
          drawCard(game, playerIndex);
          
          // Broadcast updated deck count to all players
          io.to(roomId).emit('deckCountUpdated', {
            deckCount: game.deck.length
          });
        } else {
          // Check if the game is over
          checkGameEnd(game, roomId);
        }
      }
      
      console.log(`Player ${player.username} declared a pair`);
    } else {
      socket.emit('error', 'Invalid pair');
    }
  });

  // Player drawing a card
  socket.on('drawCard', () => {
    const roomId = userRooms[socket.id];
    if (!roomId || !games[roomId]) return;
    
    const game = games[roomId];
    
    // Check if it's the player's turn
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1 || game.currentTurn !== playerIndex) {
      socket.emit('error', 'Not your turn');
      return;
    }
    
    if (game.deck.length > 0) {
      // Draw from deck
      const card = drawCard(game, playerIndex);
      
      // Notify the player of their new card
      socket.emit('cardDrawn', { card });
      
      // Notify other players that this player drew a card
      socket.to(roomId).emit('playerDrewCard', {
        playerId: socket.id,
        cardCount: game.players[playerIndex].cards.length
      });
      
      // Broadcast updated deck count to all players
      io.to(roomId).emit('deckCountUpdated', {
        deckCount: game.deck.length
      });
      
      console.log(`Player ${game.players[playerIndex].username} drew a card, deck remaining: ${game.deck.length}`);
    } else if (game.players.length > 2) {
      // If there are no more cards in the deck and more than 2 players,
      // draw from the player to the right
      const rightPlayerIndex = (playerIndex + 1) % game.players.length;
      const rightPlayer = game.players[rightPlayerIndex];
      
      if (rightPlayer.cards.length > 0) {
        // Select a random card from the right player
        const randomIndex = Math.floor(Math.random() * rightPlayer.cards.length);
        const card = rightPlayer.cards.splice(randomIndex, 1)[0];
        
        // Add the card to the current player's hand
        game.players[playerIndex].cards.push(card);
        
        // Notify the current player of their new card
        socket.emit('cardDrawn', { card, fromPlayer: rightPlayer.username });
        
        // Notify the right player that a card was taken
        io.to(rightPlayer.id).emit('cardTaken', {
          byPlayer: game.players[playerIndex].username,
          cardCount: rightPlayer.cards.length
        });
        
        // Notify other players
        io.to(roomId).emit('playerDrawFromPlayer', {
          playerId: socket.id,
          fromPlayerId: rightPlayer.id
        });
        
        console.log(`Player ${game.players[playerIndex].username} drew a card from ${rightPlayer.username}`);
      }
    }
    
    // End turn
    endTurn(game, roomId);
  });

  // End turn
  socket.on('endTurn', () => {
    const roomId = userRooms[socket.id];
    if (!roomId || !games[roomId]) return;
    
    const game = games[roomId];
    
    // Check if it's the player's turn
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1 || game.currentTurn !== playerIndex) {
      socket.emit('error', 'Not your turn');
      return;
    }
    
    endTurn(game, roomId);
  });

  // Player disconnection
  socket.on('disconnect', () => {
    const roomId = userRooms[socket.id];
    if (roomId && games[roomId]) {
      const game = games[roomId];
      
      // Find the player in the game
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        const player = game.players[playerIndex];
        
        // Notify other players
        socket.to(roomId).emit('playerLeft', {
          username: player.username,
          id: socket.id
        });
        
        console.log(`Player ${player.username} disconnected from game ${roomId}`);
        
        // Remove player from the game
        game.players.splice(playerIndex, 1);
        
        // If there are no players left, delete the game
        if (game.players.length === 0) {
          delete games[roomId];
          console.log(`Game ${roomId} deleted as all players left`);
        } 
        // If the game is ongoing and there's only one player left, they win
        else if (game.status === 'playing' && game.players.length === 1) {
          game.status = 'ended';
          game.winner = game.players[0].id;
          
          io.to(roomId).emit('gameEnded', {
            winner: game.players[0].username,
            winnerId: game.players[0].id
          });
          
          console.log(`Game ${roomId} ended, ${game.players[0].username} won by default`);
        }
        // If it was the disconnected player's turn, move to the next player
        else if (game.status === 'playing') {
          if (playerIndex <= game.currentTurn) {
            game.currentTurn = game.currentTurn % game.players.length;
            
            io.to(roomId).emit('turnChanged', {
              currentTurn: game.players[game.currentTurn].id
            });
          }
        }
      }
    }
    
    // Clean up
    delete userRooms[socket.id];
    console.log('Client disconnected:', socket.id);
  });

  // Add a new socket event for simulating empty deck
  socket.on('simulateEmptyDeck', () => {
    const roomId = userRooms[socket.id];
    if (!roomId || !games[roomId]) return;
    
    const game = games[roomId];
    
    // Empty the deck
    game.deck = [];
    
    // Broadcast updated deck count to all players
    io.to(roomId).emit('deckCountUpdated', {
      deckCount: 0
    });
    
    console.log(`Empty deck simulation triggered in game ${roomId}`);
  });
});

// Game logic functions
function generateRoomId() {
  // Generate a 6-character alphanumeric room ID
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function createDeck() {
  const deck = [];
  
  // 16 pairs (boy-girl) + 1 trickster card
  const pairs = [
    { name: 'calusar', type: 'boy' },
    { name: 'calusar', type: 'girl' },
    { name: 'pescar', type: 'boy' },
    { name: 'pescar', type: 'girl' },
    { name: 'vanator', type: 'boy' },
    { name: 'vanator', type: 'girl' },
    { name: 'gradinar', type: 'boy' },
    { name: 'gradinar', type: 'girl' },
    { name: 'cioban', type: 'boy' },
    { name: 'cioban', type: 'girl' },
    { name: 'marinar', type: 'boy' },
    { name: 'marinar', type: 'girl' },
    { name: 'cosmonaut', type: 'boy' },
    { name: 'cosmonaut', type: 'girl' },
    { name: 'doctor', type: 'boy' },
    { name: 'doctor', type: 'girl' },
    { name: 'militar', type: 'boy' },
    { name: 'militar', type: 'girl' },
    { name: 'mecanic', type: 'boy' },
    { name: 'mecanic', type: 'girl' },
    { name: 'profesor', type: 'boy' },
    { name: 'profesor', type: 'girl' },
    { name: 'brutar', type: 'boy' },
    { name: 'brutar', type: 'girl' },
    { name: 'fotbalist', type: 'boy' },
    { name: 'fotbalist', type: 'girl' },
    { name: 'artist', type: 'boy' },
    { name: 'artist', type: 'girl' },
    { name: 'bucatar', type: 'boy' },
    { name: 'bucatar', type: 'girl' },
    { name: 'muzician', type: 'boy' },
    { name: 'muzician', type: 'girl' },
    { name: 'pacalici', type: 'trickster' }
  ];
  
  // Add a unique ID to each card
  pairs.forEach((pair, index) => {
    deck.push({
      id: index + 1,
      name: pair.name,
      type: pair.type
    });
  });
  
  // Shuffle the deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}

function isPair(card1, card2) {
  // Cards form a pair if they have the same name but different types (boy/girl)
  return (
    card1.name === card2.name &&
    card1.type !== card2.type &&
    card1.type !== 'trickster' &&
    card2.type !== 'trickster'
  );
}

function dealCards(game) {
  // Give each player 4 cards
  game.players.forEach(player => {
    player.cards = [];
    for (let i = 0; i < 4; i++) {
      if (game.deck.length > 0) {
        player.cards.push(game.deck.pop());
      }
    }
  });
  
  // Return the remaining deck count
  return game.deck.length;
}

function drawCard(game, playerIndex) {
  if (game.deck.length === 0) return null;
  
  const card = game.deck.pop();
  game.players[playerIndex].cards.push(card);
  return card;
}

function endTurn(game, roomId) {
  // Move to the next player
  game.currentTurn = (game.currentTurn + 1) % game.players.length;
  
  // Notify all players
  io.to(roomId).emit('turnChanged', {
    currentTurn: game.players[game.currentTurn].id
  });
  
  // Check if the game is over
  checkGameEnd(game, roomId);
}

function checkGameEnd(game, roomId) {
  // Game ends when all cards are used and one player has the trickster card
  
  // Check if deck is empty
  if (game.deck.length > 0) return;
  
  // Check if any player has the trickster card
  let tricksterFound = false;
  let loserIndex = -1;
  
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    
    // Check if player has trickster
    const hasTrickster = player.cards.some(card => card.type === 'trickster');
    
    if (hasTrickster) {
      tricksterFound = true;
      loserIndex = i;
      break;
    }
  }
  
  // Check if only one player has cards left
  const playersWithCards = game.players.filter(p => p.cards.length > 0);
  
  if (playersWithCards.length === 1 && tricksterFound) {
    // Game over, we have a loser
    game.status = 'ended';
    game.loser = game.players[loserIndex].id;
    
    // Determine the winner (player with most pairs)
    let maxPairs = -1;
    let winnerIndex = -1;
    
    for (let i = 0; i < game.players.length; i++) {
      if (i !== loserIndex && game.players[i].pairs > maxPairs) {
        maxPairs = game.players[i].pairs;
        winnerIndex = i;
      }
    }
    
    if (winnerIndex !== -1) {
      game.winner = game.players[winnerIndex].id;
    }
    
    // Notify all players
    io.to(roomId).emit('gameEnded', {
      winner: winnerIndex !== -1 ? game.players[winnerIndex].username : null,
      winnerId: game.winner,
      loser: game.players[loserIndex].username,
      loserId: game.loser
    });
    
    console.log(`Game ${roomId} ended, ${game.players[winnerIndex].username} won, ${game.players[loserIndex].username} lost with trickster`);
  }
}

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
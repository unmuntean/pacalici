const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure Socket.io with better options for mobile compatibility
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'], // Enable both transport methods
  pingTimeout: 30000,                   // Longer ping timeout for mobile
  pingInterval: 25000,                  // Longer ping interval
  connectTimeout: 20000                 // Longer connection timeout
});

// Middleware to handle potential network issues
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Serve the main game page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
        pairs: 0,
        finished: false  // New: track if player has finished all their cards
      }],
      deck: [],
      status: 'waiting',
      currentTurn: 0,
      winners: [],     // New: multiple winners in the order they finish
      loser: null      // Final player with Păcălici
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
      pairs: 0,
      finished: false  // New: track if player has finished all their cards
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
    
    // Get player info with card counts
    const playersInfo = game.players.map(p => ({
      id: p.id,
      username: p.username,
      cards: p.cards.length
    }));
    
    // Notify all players that the game has started
    io.to(roomId).emit('gameStarted', {
      currentTurn: game.players[game.currentTurn].id,
      deckCount: remainingCards,
      playersInfo
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
    
    // Check if player already finished
    if (player.finished) {
      socket.emit('error', 'You have already finished your cards');
      return;
    }
    
    // Log received cards
    console.log(`[Server] Pair declaration received from ${player.username}:`, card1, card2);
    
    // Verify that the player has these cards
    const cardIndex1 = player.cards.findIndex(c => c.id === card1.id);
    const cardIndex2 = player.cards.findIndex(c => c.id === card2.id);
    
    if (cardIndex1 === -1 || cardIndex2 === -1) {
      console.log(`[Server] Player does not have the declared cards. Indices:`, cardIndex1, cardIndex2);
      socket.emit('error', 'You do not have these cards');
      return;
    }
    
    // Log the actual cards from player's hand
    console.log(`[Server] Found cards in player's hand:`, 
      player.cards[cardIndex1], 
      player.cards[cardIndex2]
    );
    
    // Check if the cards form a valid pair
    if (isPair(player.cards[cardIndex1], player.cards[cardIndex2])) {
      // Remove the cards from the player's hand
      const removedCards = [
        player.cards.splice(cardIndex1, 1)[0],
        player.cards.splice(cardIndex2 > cardIndex1 ? cardIndex2 - 1 : cardIndex2, 1)[0]
      ];
      
      // Increase pair count
      player.pairs += 1;
      
      // Check if the player has finished their cards
      const hasFinished = (player.cards.length === 0);
      
      // If player is finished, mark them as a winner
      if (hasFinished) {
        player.finished = true;
        
        // Add to winners list if not already a winner
        if (!game.winners.includes(player.id)) {
          game.winners.push(player.id);
        }
        
        console.log(`Player ${player.username} has finished all their cards and is out of the game!`);
      }
      
      // Notify all players about the pair
      io.to(roomId).emit('pairDeclared', {
        playerId: socket.id,
        cards: removedCards,
        remainingCardCount: player.cards.length,
        pairs: player.pairs,
        hasFinished: hasFinished
      });
      
      console.log(`Player ${player.username} declared a pair. Cards left: ${player.cards.length}`);
      
      // Check if we should end the turn and move to next player
      if (hasFinished || (player.cards.length > 0 && game.deck.length === 0)) {
        // End turn and pass to next active player
        endTurn(game, roomId);
      }
      
      // Check if the game is over (only one player left with cards)
      checkGameEnd(game, roomId);
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
    
    const player = game.players[playerIndex];
    
    // Check if player already finished
    if (player.finished) {
      socket.emit('error', 'You have already finished your cards');
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
        cardCount: player.cards.length
      });
      
      // Broadcast updated deck count to all players
      io.to(roomId).emit('deckCountUpdated', {
        deckCount: game.deck.length
      });
      
      console.log(`Player ${player.username} drew a card, deck remaining: ${game.deck.length}`);
      
      // Automatically end the turn (no more end turn button)
      endTurn(game, roomId);
    } else {
      // If deck is empty, draw from other players
      drawFromOtherPlayers(game, playerIndex, roomId);
    }
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

  // Add a new event handler for drawing a card directly from another player
  socket.on('drawFromPlayer', ({ fromPlayerId }) => {
    const roomId = userRooms[socket.id];
    if (!roomId || !games[roomId]) return;
    
    const game = games[roomId];
    
    // Check if it's the player's turn
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1 || game.currentTurn !== playerIndex) {
      socket.emit('error', 'Not your turn');
      return;
    }
    
    // Check if deck is empty (should be, but verify)
    if (game.deck.length > 0) {
      socket.emit('error', 'Deck is not empty yet');
      return;
    }
    
    // Find the player to draw from
    const fromPlayerIndex = game.players.findIndex(p => p.id === fromPlayerId);
    if (fromPlayerIndex === -1) {
      socket.emit('error', 'Player not found');
      return;
    }
    
    const fromPlayer = game.players[fromPlayerIndex];
    
    // Check if the player has cards
    if (fromPlayer.cards.length === 0) {
      socket.emit('error', 'This player has no cards');
      return;
    }
    
    // Select a random card from the player
    const randomIndex = Math.floor(Math.random() * fromPlayer.cards.length);
    const card = fromPlayer.cards.splice(randomIndex, 1)[0];
    
    // Add the card to the current player's hand
    game.players[playerIndex].cards.push(card);
    
    // Notify the current player of their new card
    socket.emit('cardDrawn', { card, fromPlayer: fromPlayer.username });
    
    // Notify the player that a card was taken
    io.to(fromPlayerId).emit('cardTaken', {
      byPlayer: game.players[playerIndex].username,
      cardCount: fromPlayer.cards.length
    });
    
    // Notify other players
    io.to(roomId).emit('playerDrawFromPlayer', {
      playerId: socket.id,
      fromPlayerId: fromPlayer.id
    });
    
    console.log(`Player ${game.players[playerIndex].username} drew a card from ${fromPlayer.username}`);
    
    // End turn
    endTurn(game, roomId);
  });

  // Refine the rearrangeCards event handler for robustness
  socket.on('rearrangeCards', ({ newOrder }) => {
    const roomId = userRooms[socket.id];
    if (!roomId || !games[roomId]) {
      socket.emit('error', 'Game room not found');
      return;
    }
    
    const game = games[roomId];
    
    // Find the player
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) {
      socket.emit('error', 'Player not found');
      return;
    }
    
    const player = game.players[playerIndex];
    const currentCardCount = player.cards.length;

    // Validate the new order array
    if (!Array.isArray(newOrder) || newOrder.length !== currentCardCount) {
      console.error(`Rearrange validation failed: Length mismatch. Expected ${currentCardCount}, got ${newOrder ? newOrder.length : 'null'}. Order:`, newOrder);
      socket.emit('error', 'Invalid card order: size mismatch');
      return;
    }
    
    // Check if all indices are valid (0 to length-1) and unique
    const receivedIndices = new Set(newOrder);
    if (receivedIndices.size !== currentCardCount) {
      console.error(`Rearrange validation failed: Duplicate or missing indices. Received:`, newOrder);
      socket.emit('error', 'Invalid card order: duplicate/missing indices');
      return;
    }

    for (const index of newOrder) {
      if (typeof index !== 'number' || index < 0 || index >= currentCardCount || !Number.isInteger(index)) {
        console.error(`Rearrange validation failed: Invalid index found: ${index}. Order:`, newOrder);
        socket.emit('error', 'Invalid card order: invalid index value');
        return;
      }
    }

    // If validation passes, rearrange the cards
    try {
      const currentCards = [...player.cards]; // Create a copy
      const rearrangedCards = newOrder.map(originalIndex => currentCards[originalIndex]);
      player.cards = rearrangedCards;

      console.log(`Player ${player.username} successfully rearranged cards. New order mapping (new index -> original index):`, newOrder);
      
      // Notify the player that their cards have been rearranged
      socket.emit('cardsRearranged', { cards: player.cards });

      // Notify other players about the card count (positions don't change for them)
      const playersInfo = game.players.map(p => ({
        id: p.id,
        username: p.username,
        cardCount: p.cards.length,
        cardPositions: p.cards.map((_, index) => index)
      }));
      io.to(roomId).emit('playersCardsInfo', { playersInfo });

    } catch (error) {
      console.error("Error during card rearrangement:", error);
      socket.emit('error', 'Failed to rearrange cards');
    }
  });

  // Fix the drawCardFromPlayer handler to properly update cards and notify all players
  socket.on('drawCardFromPlayer', ({ fromPlayerId, cardPosition }) => {
    const roomId = userRooms[socket.id];
    if (!roomId || !games[roomId]) {
      socket.emit('error', 'Game room not found');
      return;
    }
    
    const game = games[roomId];
    
    // Check if it's the player's turn
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1 || game.currentTurn !== playerIndex) {
      socket.emit('error', 'Not your turn');
      return;
    }
    
    // Check if deck is empty (should be, but verify)
    if (game.deck.length > 0) {
      socket.emit('error', 'Deck is not empty yet');
      return;
    }
    
    // Find the player to draw from
    const fromPlayerIndex = game.players.findIndex(p => p.id === fromPlayerId);
    if (fromPlayerIndex === -1) {
      socket.emit('error', 'Player not found');
      return;
    }
    
    const fromPlayer = game.players[fromPlayerIndex];
    
    // Check if the player has cards
    if (!fromPlayer.cards || fromPlayer.cards.length === 0) {
      socket.emit('error', 'This player has no cards');
      return;
    }
    
    // Check if the card position is valid
    if (cardPosition < 0 || cardPosition >= fromPlayer.cards.length) {
      console.log(`Invalid card position: ${cardPosition}, player ${fromPlayer.username} has ${fromPlayer.cards.length} cards`);
      socket.emit('error', 'Invalid card position');
      return;
    }
    
    // Take the card from the specified position
    const card = fromPlayer.cards.splice(cardPosition, 1)[0];
    
    // Add the card to the current player's hand
    game.players[playerIndex].cards.push(card);
    
    console.log(`Player ${game.players[playerIndex].username} drew card at position ${cardPosition} from ${fromPlayer.username}`);
    
    // Notify the current player of their new card
    socket.emit('cardDrawn', { 
      card, 
      fromPlayer: fromPlayer.username,
      fromPosition: cardPosition
    });
    
    // Notify the player that a card was taken
    io.to(fromPlayerId).emit('cardTaken', {
      byPlayer: game.players[playerIndex].username,
      cardCount: fromPlayer.cards.length,
      cardPosition: cardPosition
    });
    
    // Notify all players about cards count updates
    const playersInfo = game.players.map(p => ({
      id: p.id,
      username: p.username,
      cardCount: p.cards.length,
      cardPositions: p.cards.map((_, index) => index)
    }));
    
    io.to(roomId).emit('playersCardsInfo', { playersInfo });
    
    // Notify other players about the draw
    io.to(roomId).emit('playerDrawFromPlayer', {
      playerId: socket.id,
      fromPlayerId: fromPlayer.id,
      fromPosition: cardPosition
    });
    
    // End turn
    endTurn(game, roomId);
  });

  // Update the playersCardsCount event to include card positions
  socket.on('getPlayersCards', () => {
    const roomId = userRooms[socket.id];
    if (!roomId || !games[roomId]) return;
    
    const game = games[roomId];
    
    // Get detailed info about other players' cards (without revealing the actual cards)
    const playersCardsInfo = game.players.map(p => ({
      id: p.id,
      username: p.username,
      cardCount: p.cards.length,
      // Include card positions but not the actual card data
      cardPositions: p.cards.map((_, index) => index)
    }));
    
    // Send only to the requesting player
    socket.emit('playersCardsInfo', { playersCardsInfo });
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
  
  // Only nationality-based pairs (boy-girl) + 1 trickster card
  const pairs = [
    { name: 'albanezu', type: 'boy' },
    { name: 'albanezu', type: 'girl' },
    { name: 'ceh', type: 'boy' },
    { name: 'ceh', type: 'girl' },
    { name: 'chinezu', type: 'boy' },
    { name: 'chinezu', type: 'girl' },
    { name: 'coreanu', type: 'boy' },
    { name: 'coreanu', type: 'girl' },
    { name: 'mexican', type: 'boy' },
    { name: 'mexican', type: 'girl' },
    { name: 'mongolu', type: 'boy' },
    { name: 'mongolu', type: 'girl' },
    { name: 'roman', type: 'boy' },
    { name: 'roman', type: 'girl' },
    { name: 'german', type: 'boy' },
    { name: 'german', type: 'girl' },
    { name: 'vietnamez', type: 'boy' },
    { name: 'vietnamez', type: 'girl' },
    { name: 'hindus', type: 'boy' },
    { name: 'hindus', type: 'girl' },
    { name: 'negru', type: 'boy' },
    { name: 'negru', type: 'girl' },
    { name: 'rus', type: 'boy' },
    { name: 'rus', type: 'girl' },
    { name: 'maghiar', type: 'boy' },
    { name: 'maghiar', type: 'girl' },
    { name: 'arab', type: 'boy' },
    { name: 'arab', type: 'girl' },
    { name: 'polonez', type: 'boy' },
    { name: 'polonez', type: 'girl' },
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

// Add a helper function to map old card names to nationality-based cards
function mapOldCardNameToNew(oldName) {
  if (!oldName) return oldName;
  
  const nameMap = {
    'calusar': 'roman',
    'pescar': 'vietnamez',
    'vanator': 'german',
    'cioban': 'mongolu',
    'marinar': 'rus',
    'cosmonaut': 'maghiar',
    'doctor': 'hindus',
    'militar': 'albanezu',
    'mecanic': 'ceh',
    'profesor': 'polonez',
    'brutar': 'mexican',
    'fotbalist': 'arab',
    'artist': 'coreanu',
    'bucatar': 'chinezu',
    'muzician': 'negru',
    'gradinar': 'german'
  };
  
  return nameMap[oldName.toLowerCase()] || oldName;
}

// Add a utility function to normalize card data
function normalizeCardData(card) {
  // Make a copy to avoid modifying the original
  const normalizedCard = {...card};
  
  // Ensure name is lowercase for consistent comparison
  if (normalizedCard.name) {
    normalizedCard.name = normalizedCard.name.toLowerCase();
    
    // Map old card names to new nationality-based ones
    normalizedCard.name = mapOldCardNameToNew(normalizedCard.name);
  }
  
  // Ensure type is one of the expected values
  if (normalizedCard.type && !['boy', 'girl', 'trickster'].includes(normalizedCard.type)) {
    console.warn(`[Server Normalize] Unexpected card type: ${normalizedCard.type}`);
  }
  
  return normalizedCard;
}

function isPair(card1, card2) {
  // Normalize card data
  const normalizedCard1 = normalizeCardData(card1);
  const normalizedCard2 = normalizeCardData(card2);
  
  // Add debug logging
  console.log("[Server Pair Check]", 
    "Card1:", normalizedCard1.name, normalizedCard1.type, 
    "Card2:", normalizedCard2.name, normalizedCard2.type, 
    "Same name:", normalizedCard1.name === normalizedCard2.name,
    "Different types:", normalizedCard1.type !== normalizedCard2.type,
    "Not trickster:", normalizedCard1.type !== 'trickster' && normalizedCard2.type !== 'trickster'
  );
  
  // Cards form a pair if they have the same name but different types (boy/girl)
  return (
    normalizedCard1.name === normalizedCard2.name &&
    normalizedCard1.type !== normalizedCard2.type &&
    normalizedCard1.type !== 'trickster' &&
    normalizedCard2.type !== 'trickster'
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

// Helper function for drawing from other players
function drawFromOtherPlayers(game, playerIndex, roomId) {
  const socket = game.players[playerIndex].id;
  const availablePlayers = game.players.filter((p, i) => 
    i !== playerIndex && !p.finished && p.cards.length > 0
  );
  
  if (availablePlayers.length === 0) {
    io.to(socket).emit('error', 'No other players have cards to draw from');
    return;
  }
  
  // Find the next player with cards (default to the next player in turn order)
  let fromPlayerIndex = (playerIndex + 1) % game.players.length;
  while (fromPlayerIndex !== playerIndex) {
    if (!game.players[fromPlayerIndex].finished && game.players[fromPlayerIndex].cards.length > 0) {
      break;
    }
    fromPlayerIndex = (fromPlayerIndex + 1) % game.players.length;
  }
  
  const fromPlayer = game.players[fromPlayerIndex];
  
  // Select a random card from the other player
  const randomIndex = Math.floor(Math.random() * fromPlayer.cards.length);
  const card = fromPlayer.cards.splice(randomIndex, 1)[0];
  
  // Add the card to the current player's hand
  game.players[playerIndex].cards.push(card);
  
  // Notify the current player of their new card
  io.to(socket).emit('cardDrawn', { 
    card, 
    fromPlayer: fromPlayer.username,
    fromPosition: randomIndex
  });
  
  // Notify the player that a card was taken
  io.to(fromPlayer.id).emit('cardTaken', {
    byPlayer: game.players[playerIndex].username,
    cardCount: fromPlayer.cards.length,
    cardPosition: randomIndex
  });
  
  // Notify all players about the draw
  io.to(roomId).emit('playerDrawFromPlayer', {
    playerId: socket.id,
    fromPlayerId: fromPlayer.id
  });
  
  console.log(`Player ${game.players[playerIndex].username} drew a card from ${fromPlayer.username}`);
  
  // Send updated info to all players
  const playersInfo = game.players.map(p => ({
    id: p.id,
    username: p.username,
    cards: p.cards.length
  }));
  
  io.to(roomId).emit('playersCardsCount', { playersInfo });
  
  // Automatically end turn
  endTurn(game, roomId);
}

// Update the endTurn function to skip players who have finished
function endTurn(game, roomId) {
  // Start from the next player index
  let nextPlayerIndex = (game.currentTurn + 1) % game.players.length;
  const startingIndex = nextPlayerIndex;
  
  // Find the next active player
  while (game.players[nextPlayerIndex].finished) {
    nextPlayerIndex = (nextPlayerIndex + 1) % game.players.length;
    
    // If we've gone full circle, all players but one are done
    if (nextPlayerIndex === startingIndex) {
      // Only one player left (with the Păcălici) - game is over
      checkGameEnd(game, roomId);
      return;
    }
  }
  
  // Set the current turn to the next active player
  game.currentTurn = nextPlayerIndex;
  
  // Notify all players
  io.to(roomId).emit('turnChanged', {
    currentTurn: game.players[game.currentTurn].id
  });
  
  // Check if the game is over
  checkGameEnd(game, roomId);
}

// Updated gameEnd function to work with the new rules
function checkGameEnd(game, roomId) {
  // Count active players (players who haven't finished)
  const activePlayers = game.players.filter(p => !p.finished);
  
  // If only one player is left, they lose with the Păcălici
  if (activePlayers.length === 1) {
    const loser = activePlayers[0];
    
    // Check if they have the Păcălici card
    const hasTrickster = loser.cards.some(card => card.type === 'trickster');
    
    if (hasTrickster || loser.cards.length === 1) {
      // Game over - the last player with cards is the loser
      game.status = 'ended';
      game.loser = loser.id;
      
      // Get all winner names
      const winnerNames = [];
      const winnerIds = [];
      
      // Either use the winners array or calculate based on finished players
      if (game.winners.length > 0) {
        // Get names from winners array (in order of finishing)
        game.winners.forEach(winnerId => {
          const winnerPlayer = game.players.find(p => p.id === winnerId);
          if (winnerPlayer) {
            winnerNames.push(winnerPlayer.username);
            winnerIds.push(winnerPlayer.id);
          }
        });
      } else {
        // Backup: get from finished flag
        game.players.forEach(player => {
          if (player.finished) {
            winnerNames.push(player.username);
            winnerIds.push(player.id);
          }
        });
      }
      
      // Notify all players
      io.to(roomId).emit('gameEnded', {
        winners: winnerNames,
        winnersIds: winnerIds,
        loser: loser.username,
        loserId: loser.id
      });
      
      console.log(`Game ${roomId} ended, winners: ${winnerNames.join(', ')}, loser: ${loser.username} (stuck with Păcălici)`);
    }
  }
}

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all available network interfaces

server.listen(PORT, HOST, (err) => {
  if (err) {
    console.error('Error starting server:', err);
    return;
  }
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Listening on all interfaces (${HOST}:${PORT})`);
}); 
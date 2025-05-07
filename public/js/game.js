// Game state
const gameState = {
  socket: null,
  playerId: null,
  roomId: null,
  username: null,
  players: [],
  currentTurn: null,
  selectedCards: [],
  myCards: [],
  myPairs: [],
  deckCount: 0,
  isMyTurn: false,
  isDeckEmpty: false,
  selectedPlayerForDraw: null,
};

// DOM elements
const elements = {
  screens: {
    login: document.getElementById('login-screen'),
    waitingRoom: document.getElementById('waiting-room'),
    gameBoard: document.getElementById('game-board'),
    gameOver: document.getElementById('game-over')
  },
  login: {
    usernameInput: document.getElementById('username'),
    createGameBtn: document.getElementById('create-game-btn'),
    roomIdInput: document.getElementById('room-id'),
    joinGameBtn: document.getElementById('join-game-btn')
  },
  waitingRoom: {
    roomCode: document.getElementById('room-code'),
    playersList: document.getElementById('players-list'),
    startGameBtn: document.getElementById('start-game-btn'),
    waitingMessage: document.getElementById('waiting-message')
  },
  gameBoard: {
    playersList: document.getElementById('game-players-list'),
    deckCount: document.getElementById('deck-count'),
    currentPlayer: document.getElementById('current-player'),
    playerCards: document.getElementById('player-cards'),
    pairsContainer: document.getElementById('pairs-container'),
    actionButtons: document.getElementById('action-buttons'),
    drawCardBtn: document.getElementById('draw-card-btn'),
    endTurnBtn: document.getElementById('end-turn-btn'),
    simulateEmptyDeckBtn: document.getElementById('simulate-empty-deck-btn')
  },
  gameOver: {
    winnerName: document.getElementById('winner-name'),
    loserName: document.getElementById('loser-name'),
    newGameBtn: document.getElementById('new-game-btn')
  },
  notification: document.getElementById('notification'),
  notificationText: document.getElementById('notification-text'),
  rulesModal: document.getElementById('rules-modal'),
  showRulesBtn: document.getElementById('show-rules'),
  closeRulesBtn: document.getElementById('close-rules')
};

// Icons for different card types (simplified version)
const cardIcons = {
  calusar: '👨‍🎤',
  pescar: '🎣',
  vanator: '🔫',
  gradinar: '🌱',
  cioban: '🐑',
  marinar: '⚓',
  cosmonaut: '🚀',
  doctor: '⚕️',
  militar: '🪖',
  mecanic: '🔧',
  profesor: '📚',
  brutar: '🍞',
  fotbalist: '⚽',
  artist: '🎨',
  bucatar: '👨‍🍳',
  muzician: '🎵',
  pacalici: '🃏'
};

// Initialize the game
function initGame() {
  // Connect to the server
  gameState.socket = io();
  
  // Set up event listeners
  setupSocketListeners();
  setupUIListeners();
  
  // Show login screen
  showScreen('login');
}

// Set up Socket.IO event listeners
function setupSocketListeners() {
  const socket = gameState.socket;
  
  // Game creation
  socket.on('gameCreated', ({ roomId, playerId }) => {
    gameState.roomId = roomId;
    gameState.playerId = playerId;
    
    // Update UI
    elements.waitingRoom.roomCode.textContent = roomId;
    
    // Add yourself to the player list
    addPlayerToWaitingList(gameState.username, playerId);
    
    // Show waiting room
    showScreen('waitingRoom');
  });
  
  // Player joined
  socket.on('playerJoined', ({ id, username, playerCount }) => {
    // Add player to the list
    addPlayerToWaitingList(username, id);
    
    // Show notification
    showNotification(`${username} s-a alăturat jocului`);
    
    // Update start button state
    updateStartButtonState(playerCount);
  });
  
  // Game joined
  socket.on('gameJoined', ({ roomId, playerId, players }) => {
    gameState.roomId = roomId;
    gameState.playerId = playerId;
    
    // Update UI
    elements.waitingRoom.roomCode.textContent = roomId;
    
    // Add all existing players to the list
    elements.waitingRoom.playersList.innerHTML = '';
    players.forEach(player => {
      addPlayerToWaitingList(player.username, player.id);
    });
    
    // Show waiting room
    showScreen('waitingRoom');
    
    // Update start button state
    updateStartButtonState(players.length);
  });
  
  // Game started
  socket.on('gameStarted', ({ currentTurn, deckCount, playersInfo }) => {
    gameState.currentTurn = currentTurn;
    gameState.deckCount = deckCount;
    
    // Reset game state
    gameState.selectedCards = [];
    gameState.myCards = [];
    gameState.myPairs = [];
    
    // Update players with card counts
    if (playersInfo) {
      playersInfo.forEach(playerInfo => {
        const player = gameState.players.find(p => p.id === playerInfo.id);
        if (player) {
          player.cards = playerInfo.cards;
        }
      });
    }
    
    // Show game board
    showScreen('gameBoard');
    
    // Update players list in game
    updateGamePlayersList();
    
    // Update deck count
    elements.gameBoard.deckCount.textContent = deckCount;
    
    // Check if it's your turn
    checkTurn();
  });
  
  // Cards dealt
  socket.on('dealtCards', ({ cards }) => {
    gameState.myCards = cards;
    renderPlayerCards();
    
    // Update deck count
    elements.gameBoard.deckCount.textContent = 29 - (cards.length * gameState.players.length);
  });
  
  // Turn changed
  socket.on('turnChanged', ({ currentTurn }) => {
    gameState.currentTurn = currentTurn;
    
    // Update UI
    checkTurn();
    updateGamePlayersList();
  });
  
  // Player drew a card
  socket.on('playerDrewCard', ({ playerId, cardCount }) => {
    // Find player in the list
    const player = gameState.players.find(p => p.id === playerId);
    if (player) {
      showNotification(`${player.username} a tras o carte`);
    }
  });
  
  // Card drawn
  socket.on('cardDrawn', ({ card, fromPlayer }) => {
    // Add card to hand
    gameState.myCards.push(card);
    
    // Update UI
    renderPlayerCards();
    
    if (fromPlayer) {
      showNotification(`Ai tras o carte de la ${fromPlayer}`);
      // Reset selected player
      gameState.selectedPlayerForDraw = null;
      // Re-render other players' cards
      renderOtherPlayersCards();
    } else {
      showNotification('Ai tras o carte din pachet');
      
      // Update deck count
      const deckCount = parseInt(elements.gameBoard.deckCount.textContent) - 1;
      elements.gameBoard.deckCount.textContent = deckCount;
    }
  });
  
  // Card taken from you
  socket.on('cardTaken', ({ byPlayer, cardCount }) => {
    showNotification(`${byPlayer} a luat o carte de la tine`);
    
    // Re-render your cards
    renderPlayerCards();
  });
  
  // Player drew from another player
  socket.on('playerDrawFromPlayer', ({ playerId, fromPlayerId }) => {
    // Find players in the list
    const player = gameState.players.find(p => p.id === playerId);
    const fromPlayer = gameState.players.find(p => p.id === fromPlayerId);
    
    if (player && fromPlayer && playerId !== gameState.playerId && fromPlayerId !== gameState.playerId) {
      showNotification(`${player.username} a tras o carte de la ${fromPlayer.username}`);
    }
  });
  
  // Pair declared
  socket.on('pairDeclared', ({ playerId, cards, remainingCardCount, pairs }) => {
    // Find player in the list
    const player = gameState.players.find(p => p.id === playerId);
    
    if (player) {
      // Update pairs count
      player.pairs = pairs;
      
      // If it's your pair
      if (playerId === gameState.playerId) {
        // Add to your pairs
        gameState.myPairs.push(cards);
        
        // Render pairs
        renderPairs();
        
        // Remove from selected cards
        gameState.selectedCards = [];
        
        // Update cards
        gameState.myCards = gameState.myCards.filter(c => 
          !cards.some(declared => declared.id === c.id)
        );
        
        // Render cards
        renderPlayerCards();
      } else {
        showNotification(`${player.username} a format o pereche`);
        // Update the display of the other player's pairs
        renderAllPlayersPairs();
      }
      
      // Update game players list
      updateGamePlayersList();
      
      // Re-render other players' cards if deck is empty
      if (gameState.isDeckEmpty) {
        renderOtherPlayersCards();
      }
    }
  });
  
  // Game ended
  socket.on('gameEnded', ({ winner, winnerId, loser, loserId }) => {
    // Update game over screen
    elements.gameOver.winnerName.textContent = winner || 'Nimeni';
    elements.gameOver.loserName.textContent = loser;
    
    // Show game over screen
    showScreen('gameOver');
  });
  
  // Player left
  socket.on('playerLeft', ({ username, id }) => {
    // Remove player from list
    gameState.players = gameState.players.filter(p => p.id !== id);
    
    // Update UI
    updateGamePlayersList();
    
    // Show notification
    showNotification(`${username} a părăsit jocul`);
  });
  
  // Deck count updated
  socket.on('deckCountUpdated', ({ deckCount }) => {
    gameState.deckCount = deckCount;
    elements.gameBoard.deckCount.textContent = deckCount;
    
    // Update UI to show the drawing from other players if deck is empty
    if (deckCount === 0 && !gameState.isDeckEmpty) {
      gameState.isDeckEmpty = true;
      showNotification('Pachetul de cărți este gol! Acum tragi cărți de la alți jucători.');
      renderOtherPlayersCards();
    }
  });
  
  // Add an event handler for players' card counts
  socket.on('playersCardsCount', ({ playersInfo }) => {
    // Update players with card counts
    playersInfo.forEach(playerInfo => {
      const player = gameState.players.find(p => p.id === playerInfo.id);
      if (player) {
        player.cards = playerInfo.cards;
      }
    });
    
    // If deck is empty, update the other players' cards UI
    if (gameState.isDeckEmpty) {
      renderOtherPlayersCards();
    }
  });
  
  // Error handling
  socket.on('error', (message) => {
    showNotification(message, 'error');
  });
}

// Set up UI event listeners
function setupUIListeners() {
  // Create game button
  elements.login.createGameBtn.addEventListener('click', () => {
    const username = elements.login.usernameInput.value.trim();
    
    if (username) {
      gameState.username = username;
      gameState.socket.emit('createGame', username);
    } else {
      showNotification('Te rugăm să introduci un nume', 'error');
    }
  });
  
  // Join game button
  elements.login.joinGameBtn.addEventListener('click', () => {
    const username = elements.login.usernameInput.value.trim();
    const roomId = elements.login.roomIdInput.value.trim().toUpperCase();
    
    if (username && roomId) {
      gameState.username = username;
      gameState.socket.emit('joinGame', { roomId, username });
    } else {
      showNotification('Te rugăm să introduci numele și codul camerei', 'error');
    }
  });
  
  // Start game button
  elements.waitingRoom.startGameBtn.addEventListener('click', () => {
    gameState.socket.emit('startGame');
  });
  
  // Draw card button
  elements.gameBoard.drawCardBtn.addEventListener('click', () => {
    if (gameState.isMyTurn) {
      if (gameState.isDeckEmpty && gameState.selectedPlayerForDraw) {
        // If deck is empty and a player is selected, draw from that player
        gameState.socket.emit('drawFromPlayer', {
          fromPlayerId: gameState.selectedPlayerForDraw
        });
      } else {
        // Normal draw from deck
        gameState.socket.emit('drawCard');
      }
    }
  });
  
  // End turn button
  elements.gameBoard.endTurnBtn.addEventListener('click', () => {
    if (gameState.isMyTurn) {
      gameState.socket.emit('endTurn');
    }
  });
  
  // New game button
  elements.gameOver.newGameBtn.addEventListener('click', () => {
    window.location.reload();
  });
  
  // Show rules button
  elements.showRulesBtn.addEventListener('click', () => {
    elements.rulesModal.classList.remove('hidden');
  });
  
  // Close rules button
  elements.closeRulesBtn.addEventListener('click', () => {
    elements.rulesModal.classList.add('hidden');
  });
  
  // Close rules modal when clicking outside
  elements.rulesModal.addEventListener('click', (e) => {
    if (e.target === elements.rulesModal) {
      elements.rulesModal.classList.add('hidden');
    }
  });
  
  // Simulate empty deck button
  if (elements.gameBoard.simulateEmptyDeckBtn) {
    elements.gameBoard.simulateEmptyDeckBtn.addEventListener('click', () => {
      if (gameState.isMyTurn) {
        gameState.socket.emit('simulateEmptyDeck');
        showNotification('Simulare: Pachetul de cărți este acum gol');
      } else {
        showNotification('Trebuie să fie rândul tău pentru a folosi această funcție', 'error');
      }
    });
  }
}

// Helper functions
function showScreen(screenName) {
  // Hide all screens
  Object.values(elements.screens).forEach(screen => {
    screen.classList.add('hidden');
  });
  
  // Show the requested screen
  elements.screens[screenName].classList.remove('hidden');
}

function addPlayerToWaitingList(username, id) {
  // Add to state if not already there
  if (!gameState.players.some(p => p.id === id)) {
    gameState.players.push({
      id,
      username,
      pairs: 0
    });
  }
  
  // Create list item
  const listItem = document.createElement('li');
  listItem.classList.add('flex', 'items-center', 'px-3', 'py-2', 'rounded-md', 'bg-gray-50');
  
  // Highlight if it's you
  if (id === gameState.playerId) {
    listItem.classList.add('bg-blue-50', 'border-l-4', 'border-blue-500');
  }
  
  listItem.innerHTML = `
    <div class="player-avatar">${username.substring(0, 1).toUpperCase()}</div>
    <span>${username}</span>
    ${id === gameState.playerId ? '<span class="ml-auto text-sm text-blue-500">Tu</span>' : ''}
  `;
  
  // Add to the list
  elements.waitingRoom.playersList.appendChild(listItem);
}

function updateStartButtonState(playerCount) {
  // Enable start button if there are at least 2 players
  if (playerCount >= 2) {
    elements.waitingRoom.startGameBtn.disabled = false;
    elements.waitingRoom.startGameBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    elements.waitingRoom.waitingMessage.classList.add('hidden');
  } else {
    elements.waitingRoom.startGameBtn.disabled = true;
    elements.waitingRoom.startGameBtn.classList.add('opacity-50', 'cursor-not-allowed');
    elements.waitingRoom.waitingMessage.classList.remove('hidden');
  }
}

function updateGamePlayersList() {
  // Clear current list
  elements.gameBoard.playersList.innerHTML = '';
  
  // Add each player
  gameState.players.forEach(player => {
    const isCurrent = player.id === gameState.currentTurn;
    
    const listItem = document.createElement('li');
    listItem.classList.add('player-indicator');
    
    if (isCurrent) {
      listItem.classList.add('current');
    }
    
    listItem.innerHTML = `
      <div class="player-avatar">${player.username.substring(0, 1).toUpperCase()}</div>
      <div class="flex-1">
        <div class="flex justify-between items-center">
          <span>${player.username}</span>
          <span class="text-sm ${player.id === gameState.playerId ? 'text-blue-500' : ''}">${player.id === gameState.playerId ? 'Tu' : ''}</span>
        </div>
        <div class="text-sm text-gray-500">Perechi: ${player.pairs}</div>
      </div>
      ${isCurrent ? '<div class="ml-2 w-2 h-2 bg-yellow-500 rounded-full"></div>' : ''}
    `;
    
    elements.gameBoard.playersList.appendChild(listItem);
  });
}

function checkTurn() {
  gameState.isMyTurn = gameState.currentTurn === gameState.playerId;
  
  // Update current player name
  const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurn);
  if (currentPlayer) {
    elements.gameBoard.currentPlayer.textContent = currentPlayer.username;
    
    if (gameState.isMyTurn) {
      elements.gameBoard.currentPlayer.textContent += ' (Tu)';
    }
  }
  
  // Show/hide action buttons
  if (gameState.isMyTurn) {
    elements.gameBoard.actionButtons.classList.remove('hidden');
    
    // Update draw card button text based on deck state
    if (gameState.isDeckEmpty) {
      elements.gameBoard.drawCardBtn.textContent = gameState.selectedPlayerForDraw ? 
        'Trage o carte selectată' : 'Selectează o carte de la un jucător';
    } else {
      elements.gameBoard.drawCardBtn.textContent = 'Trage o carte';
    }
  } else {
    elements.gameBoard.actionButtons.classList.add('hidden');
  }
  
  // Update the other players' cards UI if deck is empty
  if (gameState.isDeckEmpty) {
    renderOtherPlayersCards();
  }
}

function renderPlayerCards() {
  // Clear the container
  elements.gameBoard.playerCards.innerHTML = '';
  
  // Add each card
  gameState.myCards.forEach(card => {
    const isSelected = gameState.selectedCards.some(c => c.id === card.id);
    
    const cardElement = document.createElement('div');
    cardElement.classList.add('card');
    
    if (isSelected) {
      cardElement.classList.add('selected');
    }
    
    // Get icon for card
    const icon = cardIcons[card.name] || '❓';
    
    cardElement.innerHTML = `
      <div class="card-inner">
        <div class="card-front ${card.type}">
          <div class="card-icon">${icon}</div>
          <div class="card-name">${formatCardName(card.name)}</div>
          <div class="card-type">${formatCardType(card.type)}</div>
        </div>
      </div>
    `;
    
    // Add click event
    cardElement.addEventListener('click', () => {
      if (!gameState.isMyTurn) return;
      
      if (isSelected) {
        // Deselect
        gameState.selectedCards = gameState.selectedCards.filter(c => c.id !== card.id);
      } else {
        // Select, but limit to 2 cards
        if (gameState.selectedCards.length < 2) {
          gameState.selectedCards.push(card);
        } else {
          // Replace the first selected card
          gameState.selectedCards.shift();
          gameState.selectedCards.push(card);
        }
      }
      
      // Re-render cards to update selection
      renderPlayerCards();
      
      // Check if we have 2 cards selected and they form a pair
      if (gameState.selectedCards.length === 2) {
        const [card1, card2] = gameState.selectedCards;
        
        // Check if they form a pair
        if (isPair(card1, card2)) {
          // Declare the pair
          gameState.socket.emit('declarePair', {
            card1,
            card2
          });
        }
      }
    });
    
    elements.gameBoard.playerCards.appendChild(cardElement);
  });
  
  // Add placeholders if less than 4 cards
  if (gameState.myCards.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.classList.add('card-placeholder');
    placeholder.innerHTML = `
      <p>Nu mai ai cărți</p>
    `;
    elements.gameBoard.playerCards.appendChild(placeholder);
  }
}

function renderPairs() {
  // Clear the container
  elements.gameBoard.pairsContainer.innerHTML = '';
  
  // Add each pair
  gameState.myPairs.forEach(pair => {
    const pairElement = document.createElement('div');
    pairElement.classList.add('flex', 'space-x-1', 'mb-2', 'p-2', 'bg-green-50', 'rounded-md');
    
    // Create elements for each card in the pair
    pair.forEach(card => {
      const cardElement = document.createElement('div');
      cardElement.classList.add('w-1/2');
      
      // Get icon for card
      const icon = cardIcons[card.name] || '❓';
      
      cardElement.innerHTML = `
        <div class="card-front ${card.type} h-16 flex items-center justify-center flex-col rounded-md">
          <div class="text-lg">${icon}</div>
          <div class="text-xs font-semibold">${formatCardName(card.name)}</div>
        </div>
      `;
      
      pairElement.appendChild(cardElement);
    });
    
    elements.gameBoard.pairsContainer.appendChild(pairElement);
  });
  
  // Add placeholder if no pairs
  if (gameState.myPairs.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.classList.add('col-span-full', 'text-center', 'text-gray-500', 'py-4');
    placeholder.textContent = 'Nu ai format încă nicio pereche';
    elements.gameBoard.pairsContainer.appendChild(placeholder);
  }
}

function showNotification(message, type = 'success') {
  // Set message
  elements.notificationText.textContent = message;
  
  // Set color based on type
  if (type === 'error') {
    elements.notification.classList.remove('border-green-500');
    elements.notification.classList.add('border-red-500');
  } else {
    elements.notification.classList.remove('border-red-500');
    elements.notification.classList.add('border-green-500');
  }
  
  // Show notification with animation
  elements.notification.classList.add('notification-show');
  
  // Remove animation class after it finishes
  setTimeout(() => {
    elements.notification.classList.remove('notification-show');
  }, 3000);
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

function formatCardName(name) {
  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatCardType(type) {
  if (type === 'boy') return 'Băiat';
  if (type === 'girl') return 'Fată';
  if (type === 'trickster') return 'Păcălici';
  return type;
}

// Add a new function to render other players' cards when the deck is empty
function renderOtherPlayersCards() {
  // Only show other players' cards if the deck is empty
  if (!gameState.isDeckEmpty) return;
  
  // Create or update the container for other players' cards
  let otherPlayersContainer = document.getElementById('other-players-cards');
  
  if (!otherPlayersContainer) {
    otherPlayersContainer = document.createElement('div');
    otherPlayersContainer.id = 'other-players-cards';
    otherPlayersContainer.className = 'mt-6';
    
    const heading = document.createElement('h2');
    heading.className = 'text-lg font-semibold mb-2';
    heading.textContent = 'Cărțile altor jucători';
    
    otherPlayersContainer.appendChild(heading);
    
    // Insert after your cards
    elements.gameBoard.playerCards.parentNode.after(otherPlayersContainer);
  }
  
  // Clear the container
  while (otherPlayersContainer.childNodes.length > 1) {
    otherPlayersContainer.removeChild(otherPlayersContainer.lastChild);
  }
  
  // Get other players (players other than yourself)
  const otherPlayers = gameState.players.filter(p => p.id !== gameState.playerId);
  
  // Create a section for each player
  otherPlayers.forEach(player => {
    // Skip players with no cards
    if (player.cards && player.cards.length === 0) return;
    
    const playerSection = document.createElement('div');
    playerSection.className = 'mb-4';
    
    const playerName = document.createElement('h3');
    playerName.className = 'text-md font-medium mb-1';
    playerName.textContent = `${player.username} - ${player.cards} cărți`;
    
    playerSection.appendChild(playerName);
    
    // Create a grid for the cards
    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'grid grid-cols-5 gap-2';
    
    // Create card backs for this player
    for (let i = 0; i < player.cards; i++) {
      const cardBack = document.createElement('div');
      cardBack.className = 'card-back h-16 rounded-md cursor-pointer transform transition-transform hover:scale-105';
      
      // Add click handler to select this player for drawing
      cardBack.addEventListener('click', () => {
        if (gameState.isMyTurn) {
          // Set the selected player
          gameState.selectedPlayerForDraw = player.id;
          
          // Update UI to show which player is selected
          document.querySelectorAll('.card-back').forEach(card => {
            card.classList.remove('ring-2', 'ring-blue-500');
          });
          
          cardBack.classList.add('ring-2', 'ring-blue-500');
          
          showNotification(`Selectat pentru a trage o carte de la ${player.username}`);
        }
      });
      
      // Add selected style if this player is already selected
      if (player.id === gameState.selectedPlayerForDraw) {
        cardBack.classList.add('ring-2', 'ring-blue-500');
      }
      
      cardsGrid.appendChild(cardBack);
    }
    
    playerSection.appendChild(cardsGrid);
    otherPlayersContainer.appendChild(playerSection);
  });
}

// Add a new function to render all players' pairs
function renderAllPlayersPairs() {
  // Get the container for all players' pairs
  let allPairsContainer = document.getElementById('all-players-pairs');
  
  // Create the container if it doesn't exist
  if (!allPairsContainer) {
    allPairsContainer = document.createElement('div');
    allPairsContainer.id = 'all-players-pairs';
    allPairsContainer.className = 'bg-white rounded-lg shadow-md p-4 mt-4';
    
    const heading = document.createElement('h2');
    heading.className = 'text-lg font-semibold mb-2';
    heading.textContent = 'Perechi formate de toți jucătorii';
    
    allPairsContainer.appendChild(heading);
    
    // Insert after the pairs container
    elements.gameBoard.pairsContainer.parentNode.after(allPairsContainer);
  }
  
  // Clear existing content except the heading
  while (allPairsContainer.childNodes.length > 1) {
    allPairsContainer.removeChild(allPairsContainer.lastChild);
  }
  
  // Create a section for each player's pairs
  gameState.players.forEach(player => {
    if (player.pairs > 0) {
      const playerSection = document.createElement('div');
      playerSection.className = 'mb-3 pb-2 border-b border-gray-200';
      
      const playerName = document.createElement('h3');
      playerName.className = 'text-md font-medium mb-1';
      playerName.textContent = `${player.username} - ${player.pairs} perechi`;
      
      playerSection.appendChild(playerName);
      
      // If it's the current player, we have the actual pairs data
      if (player.id === gameState.playerId) {
        // Add a visual representation of the pairs
        const pairsContainer = document.createElement('div');
        pairsContainer.className = 'grid grid-cols-2 sm:grid-cols-3 gap-2';
        
        gameState.myPairs.forEach(pair => {
          const pairElement = document.createElement('div');
          pairElement.className = 'bg-green-50 p-1 rounded-md flex space-x-1';
          
          pair.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'w-1/2';
            
            // Get icon for card
            const icon = cardIcons[card.name] || '❓';
            
            cardElement.innerHTML = `
              <div class="h-10 flex items-center justify-center flex-col rounded-md bg-white">
                <div class="text-sm">${icon}</div>
                <div class="text-xs">${formatCardName(card.name)}</div>
              </div>
            `;
            
            pairElement.appendChild(cardElement);
          });
          
          pairsContainer.appendChild(pairElement);
        });
        
        playerSection.appendChild(pairsContainer);
      } else {
        // For other players, we just show the number of pairs
        const pairsDisplay = document.createElement('div');
        pairsDisplay.className = 'flex flex-wrap gap-2';
        
        // Create a simple representation for each pair
        for (let i = 0; i < player.pairs; i++) {
          const pairSymbol = document.createElement('div');
          pairSymbol.className = 'bg-green-50 p-1 rounded-md flex items-center justify-center w-12 h-8';
          pairSymbol.textContent = '👥';
          pairsDisplay.appendChild(pairSymbol);
        }
        
        playerSection.appendChild(pairsDisplay);
      }
      
      allPairsContainer.appendChild(playerSection);
    }
  });
  
  // Add a message if no pairs have been formed
  if (allPairsContainer.childNodes.length <= 1) {
    const message = document.createElement('p');
    message.className = 'text-center text-gray-500 py-2';
    message.textContent = 'Niciun jucător nu a format perechi încă.';
    allPairsContainer.appendChild(message);
  }
}

// Initialize the game when the page loads
window.addEventListener('load', initGame); 
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
  selectedCardPosition: null,
  isDragging: false,
  draggedCard: null,
  draggedCardIndex: null,
  finishedPlayers: [], // Track players who have finished their cards
  gameRules: {} // Store the active game rules
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

// Icons for different card types (only using image-based cards)
const cardIcons = {
  // Only using nationalities with actual images
  albanezu: '👤',
  ceh: '👤',
  chinezu: '👤',
  coreanu: '👤',
  mexican: '👤',
  mongolu: '👤',
  roman: '👤',
  german: '👤',
  vietnamez: '👤',
  hindus: '👤',
  negru: '👤',
  rus: '👤',
  maghiar: '👤',
  arab: '👤', // Changed from fotbalist
  polonez: '👤', // Changed from profesor
  pacalici: '🃏'
};

// Images for different card types (mapping to actual image files)
const cardImages = {
  albanezu: {
    boy: '/img/albanezu.png',
    girl: '/img/albaneza.png'
  },
  ceh: {
    boy: '/img/ceh.png',
    girl: '/img/ceha.png'
  },
  chinezu: {
    boy: '/img/chinezu.png',
    girl: '/img/chineza.png'
  },
  coreanu: {
    boy: '/img/coreanu.png',
    girl: '/img/coreana.png'
  },
  mexican: {
    boy: '/img/mexican.png',
    girl: '/img/mexicana.png'
  },
  mongolu: {
    boy: '/img/mongolu.png',
    girl: '/img/mongola.png'
  },
  roman: {
    boy: '/img/roman.png',
    girl: '/img/romanca.png'
  },
  // Add the other card types that need images
  german: {
    boy: '/img/german.png',
    girl: '/img/germana.png'
  },
  vietnamez: {
    boy: '/img/vietnamez.png',
    girl: '/img/vietnameza.png'
  },
  hindus: {
    boy: '/img/hindus.png',
    girl: '/img/hindusa.png'
  },
  negru: {
    boy: '/img/negru.png',
    girl: '/img/negresa.png'
  },
  rus: {
    boy: '/img/rus.png',
    girl: '/img/rusoaica.png'
  },
  maghiar: {
    boy: '/img/maghiar.png',
    girl: '/img/maghiara.png'
  },
  arab: {
    boy: '/img/arab.png',
    girl: '/img/araboaica.png'
  },
  polonez: {
    boy: '/img/polonez.png',
    girl: '/img/poloneza.png'
  },
  pacalici: {
    trickster: '/img/pacalici.png'
  }
};

// Add a function to check if images exist and log issues
function preloadCardImages() {
  console.log("[Image Debug] Starting image preload check");
  
  // Check for each card type
  for (const [cardName, cardTypes] of Object.entries(cardImages)) {
    for (const [type, imagePath] of Object.entries(cardTypes)) {
      // Create an image element to test loading
      const img = new Image();
      img.onload = () => {
        console.log(`[Image Debug] Successfully loaded: ${imagePath}`);
      };
      img.onerror = () => {
        console.error(`[Image Debug] Failed to load: ${imagePath}`);
      };
      img.src = imagePath;
    }
  }
}

// Initialize the game
function initGame() {
  // Show loading message
  showConnectingMessage();
  
  // Get the hostname dynamically
  const hostname = window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : '';
  const protocol = window.location.protocol;
  
  // Check if we should force polling transport
  const forcePolling = localStorage.getItem('force_polling') === 'true';
  
  // Debug connection info
  console.log(`[Connection] Connecting to ${protocol}//${hostname}${port}`);
  console.log(`[Connection] Force polling mode: ${forcePolling}`);
  
  // Set transport options based on compatibility mode
  const transportOptions = forcePolling ? 
    ['polling', 'websocket'] : // Polling first if forced
    ['websocket', 'polling'];  // WebSocket first by default
  
  // Connect to the server with better options for mobile and desktop compatibility
  gameState.socket = io({
    transports: transportOptions,
    reconnectionAttempts: 10,              // Increased retry attempts
    reconnectionDelay: 1000,               // Start with 1s delay
    reconnectionDelayMax: 5000,            // Maximum 5s delay
    timeout: 20000,                        // 20s connection timeout
    forceNew: true,                        // Force a new connection
    upgrade: !forcePolling,                // Allow transport upgrade unless we're forcing polling
    autoConnect: true,                     // Auto connect
    query: { 
      "clientType": "browser",
      "mobile": /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    }
  });
  
  // Add connection event listeners with more detailed logging
  gameState.socket.on('connect', () => {
    console.log('[Socket] Connected successfully');
    console.log('[Socket] Transport:', gameState.socket.io.engine.transport.name);
    hideConnectingMessage();
    
    // Initialize game rules UI
    if (typeof gameRules !== 'undefined') {
      gameRules.renderRulesUI(document.getElementById('game-rules-options'));
    }
    
    // Check image loading
    preloadCardImages();
    
    // Show login screen
    showScreen('login');
  });
  
  gameState.socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error);
    console.error('[Socket] Connection URL:', gameState.socket.io.uri);
    showConnectionError('Nu s-a putut conecta la server. Verifică conexiunea la internet și încearcă din nou.');
  });
  
  // Enhanced reconnection logic
  let reconnectAttempts = 0;
  gameState.socket.on('reconnect_attempt', (attemptNumber) => {
    reconnectAttempts = attemptNumber;
    console.log(`[Socket] Reconnection attempt ${attemptNumber}...`);
    
    // On later reconnect attempts, try switching transport
    if (attemptNumber > 3) {
      console.log('[Socket] Switching to polling transport for reconnection');
      gameState.socket.io.opts.transports = ['polling', 'websocket'];
    }
    
    showConnectingMessage(`Reconectare... (Încercare ${attemptNumber}/10)`);
  });
  
  gameState.socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    if (reason === 'io server disconnect') {
      // Server forced disconnect
      showConnectionError('Conexiunea cu serverul a fost întreruptă. Reîncărcați pagina pentru a încerca din nou.');
    } else {
      // Trying to reconnect automatically
      showConnectingMessage('Reconectare...');
    }
  });
  
  gameState.socket.on('reconnect', (attemptNumber) => {
    console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
    hideConnectingMessage();
    // No need to refresh - just continue where we left off
  });
  
  gameState.socket.on('reconnect_failed', () => {
    console.error('[Socket] Failed to reconnect after multiple attempts');
    
    // Show detailed connection troubleshooting for mobile
    let errorMessage = 'Reconectarea la server a eșuat. Încearcă următoarele:';
    errorMessage += '<br>1. Verifică conexiunea la internet';
    errorMessage += '<br>2. Închide și redeschide browser-ul';
    errorMessage += '<br>3. Încearcă un browser diferit';
    errorMessage += '<br>4. Încearcă să te conectezi prin rețeaua de date mobile';
    
    showConnectionError(errorMessage);
  });
  
  // Set up other event listeners
  setupSocketListeners();
  setupUIListeners();
}

// Add utility functions for connection messaging
function showConnectingMessage(message = 'Conectare la server...') {
  // Create or get connecting overlay
  let overlay = document.getElementById('connecting-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'connecting-overlay';
    overlay.className = 'fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center z-50';
    
    const content = document.createElement('div');
    content.className = 'bg-gray-800 p-6 rounded-lg shadow-lg text-center';
    content.innerHTML = `
      <div class="loading-spinner mb-4"></div>
      <p id="connecting-message" class="text-white text-lg"></p>
    `;
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
  }
  
  // Update message
  document.getElementById('connecting-message').textContent = message;
  overlay.style.display = 'flex';
}

function hideConnectingMessage() {
  const overlay = document.getElementById('connecting-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

function showConnectionError(message) {
  // Create or get connecting overlay
  let overlay = document.getElementById('connecting-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'connecting-overlay';
    overlay.className = 'fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center z-50';
    document.body.appendChild(overlay);
  }
  
  // Include connection debug info
  const debugInfo = navigator.userAgent;
  const connectionType = navigator.connection ? 
    `${navigator.connection.effectiveType || 'unknown'} (${navigator.onLine ? 'online' : 'offline'})` : 
    'unknown';
  
  // Update with error content
  overlay.innerHTML = `
    <div class="bg-gray-800 p-6 rounded-lg shadow-lg text-center max-w-md">
      <div class="text-red-500 text-5xl mb-4">⚠️</div>
      <h2 class="text-white text-xl font-bold mb-2">Eroare de conexiune</h2>
      <p class="text-white mb-4">${message}</p>
      <div class="mb-4 text-xs text-gray-400 text-left p-2 bg-gray-700 rounded overflow-auto max-h-24">
        <div>Browser: ${debugInfo}</div>
        <div>Conexiune: ${connectionType}</div>
        <div>Adresă: ${window.location.href}</div>
      </div>
      <button id="retry-connection" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
        Reîncărcați pagina
      </button>
      <button id="force-polling" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded mt-2">
        Forțează conexiune alternativă
      </button>
    </div>
  `;
  
  // Add reload button functionality
  document.getElementById('retry-connection').addEventListener('click', () => {
    window.location.reload();
  });
  
  // Add force polling button functionality
  document.getElementById('force-polling').addEventListener('click', () => {
    localStorage.setItem('force_polling', 'true');
    window.location.reload();
  });
  
  overlay.style.display = 'flex';
  
  // Add special fix for iOS Safari which might have connectivity issues
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    console.log('[Connection] iOS device detected, applying special fixes');
    // Forces a network activity which can help in some iOS versions
    fetch(window.location.href + '?ping=' + Date.now()).catch(() => {});
  }
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
    
    // Show waiting room and render rules options
    showScreen('waitingRoom');
    if (typeof gameRules !== 'undefined') {
      gameRules.renderRulesUI(document.getElementById('game-rules-options'));
    }
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
  socket.on('gameJoined', ({ roomId, playerId, players, activeRules }) => {
    gameState.roomId = roomId;
    gameState.playerId = playerId;
    
    // Update UI
    elements.waitingRoom.roomCode.textContent = roomId;
    
    // Add all existing players to the list
    elements.waitingRoom.playersList.innerHTML = '';
    players.forEach(player => {
      addPlayerToWaitingList(player.username, player.id);
    });
    
    // Update game rules if provided
    if (activeRules && typeof gameRules !== 'undefined') {
      Object.keys(activeRules).forEach(ruleId => {
        gameRules.setRule(ruleId, activeRules[ruleId]);
      });
      gameRules.renderRulesUI(document.getElementById('game-rules-options'));
    }
    
    // Show waiting room
    showScreen('waitingRoom');
    
    // Update start button state
    updateStartButtonState(players.length);
  });
  
  // Game started
  socket.on('gameStarted', ({ currentTurn, deckCount, playersInfo, activeRules }) => {
    gameState.currentTurn = currentTurn;
    gameState.deckCount = deckCount;
    
    // Store active game rules
    if (activeRules) {
      gameState.gameRules = activeRules;
    }
    
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
    console.log("[Socket Event] Received dealtCards:", cards);
    gameState.myCards = cards;
    renderPlayerCards();
    
    // Update deck count - This calculation might be slightly off if players joined/left mid-deal
    // Let's rely on server-sent deck counts instead.
    // elements.gameBoard.deckCount.textContent = 29 - (cards.length * gameState.players.length);
  });
  
  // Turn changed
  socket.on('turnChanged', ({ currentTurn }) => {
    const previousTurn = gameState.currentTurn;
    gameState.currentTurn = currentTurn;
    
    // Update UI
    checkTurn();
    updateGamePlayersList();
    
    // Play sound when the turn changes TO this player (it's now your turn)
    // But only if it's not the initial turn assignment
    if (previousTurn !== null && currentTurn === gameState.playerId) {
      playSound('turn');
    }
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
  socket.on('cardDrawn', ({ card, fromPlayer, fromPosition }) => {
    console.log("[Socket Event] Received cardDrawn:", card, "from:", fromPlayer || 'Deck');
    // Add card to hand
    gameState.myCards.push(card);
    
    // Update UI
    renderPlayerCards();
    
    if (fromPlayer) {
      showNotification(`Ai tras cartea #${fromPosition + 1} de la ${fromPlayer}`);
      // Reset selection without removing the card visually
      gameState.selectedPlayerForDraw = null;
      gameState.selectedCardPosition = null;
      
      // Keep the card visually for other players (handled by server)
      // Just request updated info to keep UI in sync
      console.log("[Rendering] Triggering requestOtherPlayersCards after drawing from player.");
      requestOtherPlayersCards(); 
      
      // Update draw button text back to default
      checkTurn(); 
    } else {
      // Play sound when drawing from deck (server confirmed)
      playSound('draw');
      showNotification('Ai tras o carte din pachet');
    }
  });
  
  // Card taken from you
  socket.on('cardTaken', ({ byPlayer, cardCount, cardPosition }) => {
    showNotification(`${byPlayer} a luat cartea ta de pe poziția ${cardPosition + 1}`);
    
    // --- FIX: Remove the card from the local game state --- 
    if (gameState.myCards && gameState.myCards.length > cardPosition) {
      const removedCard = gameState.myCards.splice(cardPosition, 1)[0];
      console.log(`[Card Taken] Removed card from my hand at position ${cardPosition}:`, removedCard);
    } else {
      console.error(`[Card Taken] Error: Invalid cardPosition ${cardPosition} or myCards array issue.`);
    }
    // -------------------------------------------------------

    // Re-render your cards to reflect the removal
    renderPlayerCards();
    
    // Request updated info for other players if deck is empty (less critical now, but good for sync)
    if (gameState.isDeckEmpty) {
      requestOtherPlayersCards(); 
    }
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
  socket.on('pairDeclared', ({ playerId, cards, remainingCardCount, pairs, hasFinished }) => {
    // Find player in the list
    const player = gameState.players.find(p => p.id === playerId);
    
    if (player) {
      // Update pairs count
      player.pairs = pairs;
      
      // If it's your pair
      if (playerId === gameState.playerId) {
        // Play match sound when server confirms the pair
        playSound('match');
        
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
        
        // If player has finished their cards, show notification
        if (hasFinished && remainingCardCount === 0) {
          showNotification('Ai format toate perechile! Ai terminat jocul.', 'success');
          gameState.finishedPlayers.push(playerId);
        }
      } else {
        // If other player finished their cards
        if (hasFinished && remainingCardCount === 0) {
          showNotification(`${player.username} a format toate perechile și a terminat jocul!`, 'success');
          gameState.finishedPlayers.push(playerId);
        } else {
          showNotification(`${player.username} a format o pereche`);
        }
        
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
  socket.on('gameEnded', ({ winners, winnersIds, loser, loserId }) => {
    // Update game over screen
    if (Array.isArray(winners)) {
      elements.gameOver.winnerName.textContent = winners.join(', ');
    } else {
      elements.gameOver.winnerName.textContent = winners || 'Nimeni';
    }
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
      requestOtherPlayersCards();
      renderPlayerCards(); // Re-render to add drag functionality
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
  
  // Handle detailed players cards info
  socket.on('playersCardsInfo', ({ playersCardsInfo }) => {
    console.log("[Socket Event] Received playersCardsInfo:", playersCardsInfo);
    let stateChanged = false;
    // Update the players' cards info in the game state
    playersCardsInfo.forEach(playerInfo => {
      const player = gameState.players.find(p => p.id === playerInfo.id);
      if (player) {
        // Update card count and positions only if they changed
        if (player.cards !== playerInfo.cardCount || JSON.stringify(player.cardPositions) !== JSON.stringify(playerInfo.cardPositions)) {
            player.cards = playerInfo.cardCount; 
            player.cardPositions = playerInfo.cardPositions;
            console.log(`[State Update] Updated player ${player.username}: count=${player.cards}, positions=`, player.cardPositions);
            stateChanged = true;
        }
      } else {
        console.warn("Player not found in gameState for info:", playerInfo);
      }
    });
    
    // Re-render the display of other players' cards if the state actually changed
    if (stateChanged && gameState.isDeckEmpty) {
        console.log("[Rendering] Triggering renderOtherPlayersCards due to playersCardsInfo update.");
        renderOtherPlayersCards();
    }
    
    // Also update the main player list 
    updateGamePlayersList();
  });
  
  // Add a handler for cards rearranged
  socket.on('cardsRearranged', ({ cards }) => {
    gameState.myCards = cards;
    renderPlayerCards();
    showNotification('Ordinea cărților a fost schimbată');
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
    // Get current rules settings
    const activeRules = (typeof gameRules !== 'undefined') ? gameRules.getAllRules() : {};
    
    // Send start game with rules
    gameState.socket.emit('startGame', { rules: activeRules });
  });
  
  // Draw card button
  elements.gameBoard.drawCardBtn.addEventListener('click', () => {
    if (gameState.isMyTurn) {
      if (gameState.isDeckEmpty) {
        if (gameState.selectedPlayerForDraw !== null && gameState.selectedCardPosition !== null) {
          console.log('Drawing card from player:', gameState.selectedPlayerForDraw, 'position:', gameState.selectedCardPosition);
          
          // Draw specific card from player
          gameState.socket.emit('drawCardFromPlayer', {
            fromPlayerId: gameState.selectedPlayerForDraw,
            cardPosition: gameState.selectedCardPosition
          });
          
          // Reset selection after drawing
          gameState.selectedPlayerForDraw = null;
          gameState.selectedCardPosition = null;
        } else {
          showNotification('Selectează o carte de la un jucător', 'error');
        }
      } else {
        // Normal draw from deck - play sound
        playSound('draw');
        
        // Emit the draw card event
        gameState.socket.emit('drawCard');
      }
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
    const isYou = player.id === gameState.playerId;
    const hasFinished = gameState.finishedPlayers.includes(player.id);
    
    const listItem = document.createElement('li');
    listItem.classList.add('player-indicator');
    
    if (isCurrent) {
      listItem.classList.add('current');
    }
    
    if (hasFinished) {
      listItem.classList.add('finished');
    }
    
    listItem.innerHTML = `
      <div class="player-avatar">${player.username.substring(0, 1).toUpperCase()}</div>
      <div class="flex-1">
        <div class="flex justify-between items-center">
          <span class="text-gray-200">${player.username}</span>
          ${isYou ? '<span class="text-sm text-blue-400">Tu</span>' : ''}
          ${hasFinished ? '<span class="text-sm text-green-400">✓ Terminat</span>' : ''}
        </div>
        <div class="text-sm text-gray-400">Perechi: ${player.pairs || 0}</div>
      </div>
      ${isCurrent && !hasFinished ? '<div class="your-turn-indicator ml-2">➤</div>' : ''}
    `;
    
    elements.gameBoard.playersList.appendChild(listItem);
  });
}

function checkTurn() {
  gameState.isMyTurn = gameState.currentTurn === gameState.playerId;
  
  // If player has finished, they can't take any actions
  const playerHasFinished = gameState.finishedPlayers.includes(gameState.playerId);
  
  // Update current player name
  const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurn);
  if (currentPlayer) {
    elements.gameBoard.currentPlayer.textContent = currentPlayer.username;
    
    if (gameState.isMyTurn) {
      elements.gameBoard.currentPlayer.textContent += ' (Tu)';
    }
  }
  
  // Show/hide action buttons
  if (gameState.isMyTurn && !playerHasFinished) {
    elements.gameBoard.actionButtons.classList.remove('hidden');
    
    // Update draw card button text based on deck state and selection
    if (gameState.isDeckEmpty) {
      if (gameState.selectedPlayerForDraw && gameState.selectedCardPosition !== null) {
        const selectedPlayer = gameState.players.find(p => p.id === gameState.selectedPlayerForDraw);
        if (selectedPlayer) {
          elements.gameBoard.drawCardBtn.innerHTML = `<span>Trage cartea #${gameState.selectedCardPosition + 1} de la ${selectedPlayer.username}</span>`;
        } else {
          elements.gameBoard.drawCardBtn.textContent = 'Selectează o carte';
        }
      } else {
        elements.gameBoard.drawCardBtn.textContent = 'Selectează o carte de la un jucător';
      }
    } else {
      elements.gameBoard.drawCardBtn.textContent = 'Trage o carte';
    }
  } else {
    elements.gameBoard.actionButtons.classList.add('hidden');
  }
  
  // Update the other players' cards UI if deck is empty
  if (gameState.isDeckEmpty) {
    requestOtherPlayersCards();
  }
}

// Add a helper function to validate card types
function isValidNationalityCard(cardName) {
  // List of all valid nationality cards
  const validCards = [
    'albanezu', 'ceh', 'chinezu', 'coreanu', 'mexican', 
    'mongolu', 'roman', 'german', 'vietnamez', 'hindus', 
    'negru', 'rus', 'maghiar', 'arab', 'polonez', 'pacalici'
  ];
  
  return validCards.includes(cardName.toLowerCase());
}

// Modify the renderPlayerCards function to check for nationality cards
function renderPlayerCards() {
  // Clear the container
  elements.gameBoard.playerCards.innerHTML = '';
  
  // Check if player has finished
  const playerHasFinished = gameState.finishedPlayers.includes(gameState.playerId);
  
  if (playerHasFinished) {
    // Display finished message
    const finishedMessage = document.createElement('div');
    finishedMessage.className = 'bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4 rounded';
    finishedMessage.innerHTML = `
      <div class="flex items-center">
        <div class="py-1"><svg class="h-6 w-6 text-green-500 mr-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg></div>
        <div>
          <p class="font-bold">Ai terminat jocul!</p>
          <p class="text-sm">Ai format toate perechile și aștepți ca ceilalți jucători să termine.</p>
        </div>
      </div>
    `;
    elements.gameBoard.playerCards.appendChild(finishedMessage);
    return;
  }
  
  // Add 'reorder cards' instruction if deck is empty
  if (gameState.isDeckEmpty && gameState.myCards.length > 1) {
    const reorderInstructions = document.createElement('div');
    reorderInstructions.className = 'flex items-center justify-between mb-2 text-sm text-gray-400 bg-gray-700 bg-opacity-50 p-2 rounded';
    reorderInstructions.innerHTML = `
      <span>Trage pentru a rearanja cărțile (ascunde Păcăliciul)</span>
      <span class="ml-2 text-yellow-400">↔️</span>
    `;
    elements.gameBoard.playerCards.appendChild(reorderInstructions);
  }
  
  console.log("[Render] Rendering myCards. Current cards in gameState:", JSON.parse(JSON.stringify(gameState.myCards)));
  
  // Add each card
  gameState.myCards.forEach((card, index) => {
    // Normalize card data
    const normalizedCard = normalizeCardData(card);
    
    // Check if it's a valid nationality card
    let cardImageSrc = '';
    let cardName = normalizedCard.name;
    
    // If it's not a valid nationality card, force the mapping
    if (!isValidNationalityCard(normalizedCard.name) && normalizedCard.name !== 'pacalici') {
      const mappedName = mapOldCardNameToNew(normalizedCard.name);
      if (isValidNationalityCard(mappedName)) {
        cardName = mappedName;
        console.log(`[Card Render] Mapped old card ${normalizedCard.name} to ${cardName}`);
      } else {
        console.warn(`[Card Render] Invalid card name: ${normalizedCard.name}, no mapping found`);
      }
    }
    
    // Set the image source based on card name and type
    try {
      if (cardName === 'pacalici') {
        cardImageSrc = cardImages.pacalici.trickster;
      } else if (cardImages[cardName] && cardImages[cardName][normalizedCard.type]) {
        cardImageSrc = cardImages[cardName][normalizedCard.type];
      } else {
        // Fallback to placeholder image for invalid cards
        console.warn(`[Card Render] No image for ${cardName}/${normalizedCard.type}`);
        cardImageSrc = '/img/placeholder.png';
      }
    } catch (err) {
      console.error('[Card Render] Error getting card image:', err);
      cardImageSrc = '/img/placeholder.png';
    }
    
    // Create card element
    const cardElement = document.createElement('div');
    cardElement.classList.add('card');
    
    const isSelected = gameState.selectedCards.some(c => c.id === card.id);
    if (isSelected) {
      cardElement.classList.add('selected');
    }
    
    // Add drag attributes for rearranging
    if (gameState.isDeckEmpty && gameState.myCards.length > 1) {
      cardElement.setAttribute('draggable', 'true');
      cardElement.dataset.index = index;
    }
    
    // Add position indicator if deck is empty
    const positionIndicator = gameState.isDeckEmpty ? 
      `<div class="card-position-indicator">${index + 1}</div>` : '';
    
    // Render card with image
    cardElement.innerHTML = `
      ${positionIndicator}
      <div class="card-inner">
        <div class="card-front ${normalizedCard.type}">
          <img 
            src="${cardImageSrc}" 
            alt="${formatCardName(cardName)}" 
            class="card-img" 
            onerror="console.error('[Image Error] Failed to load: ' + this.src); this.onerror=null; this.src='/img/placeholder.png';"
          >
          <div class="card-type">${formatCardType(normalizedCard.type)}</div>
        </div>
      </div>
    `;
    
    // Add click event for selecting to form pairs
    cardElement.addEventListener('click', () => {
      if (!gameState.isMyTurn || gameState.isDragging) return;
      
      // Add sound effect for card selection
      playSound('click');
      
      if (isSelected) {
        // Deselect
        console.log("[Card Deselected]", card);
        gameState.selectedCards = gameState.selectedCards.filter(c => c.id !== card.id);
      } else {
        // Select, but limit to 2 cards
        console.log("[Card Selected]", card);
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
        console.log("[Checking Pair]", card1, card2);
        
        // Check if they form a pair
        if (isPair(card1, card2)) {
          // Don't play sound here - wait for server confirmation
          console.log("[Pair Matched] Sending to server");
          
          // Declare the pair
          gameState.socket.emit('declarePair', {
            card1,
            card2
          });
        } else {
          console.log("[Pair Failed] Cards don't form a valid pair");
        }
      }
    });
    
    elements.gameBoard.playerCards.appendChild(cardElement);
  });
  
  // Add placeholders if no cards
  if (gameState.myCards.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.classList.add('card-placeholder');
    placeholder.innerHTML = `
      <p class="text-gray-400">Nu mai ai cărți</p>
    `;
    elements.gameBoard.playerCards.appendChild(placeholder);
  }
  
  // Setup drag-and-drop for rearranging if deck is empty
  if (gameState.isDeckEmpty) {
    setupCardDragging();
  }
}

function renderPairs() {
  // Clear the container
  elements.gameBoard.pairsContainer.innerHTML = '';
  
  // Add each pair
  gameState.myPairs.forEach(pair => {
    const pairElement = document.createElement('div');
    pairElement.classList.add('pair-item');
    
    // Create elements for each card in the pair
    pair.forEach(card => {
      const cardElement = document.createElement('div');
      cardElement.classList.add('w-1/2');
      
      // Normalize card data
      const normalizedCard = normalizeCardData(card);
      
      // Get the image for the card
      let cardImageSrc = '';
      if (normalizedCard.name === 'pacalici') {
        cardImageSrc = cardImages.pacalici.trickster;
      } else if (cardImages[normalizedCard.name] && cardImages[normalizedCard.name][normalizedCard.type]) {
        cardImageSrc = cardImages[normalizedCard.name][normalizedCard.type];
      }
      
      if (cardImageSrc) {
        // Use image for card - modified to be more consistent with main card style
        cardElement.innerHTML = `
          <div class="h-16 flex items-center justify-center overflow-hidden rounded-md bg-opacity-50 bg-gray-800">
            <img src="${cardImageSrc}" alt="${formatCardName(normalizedCard.name)}" class="h-16 object-cover w-full">
          </div>
        `;
      } else {
        // Fallback to emoji
        const icon = cardIcons[normalizedCard.name] || '❓';
        cardElement.innerHTML = `
          <div class="h-16 flex items-center justify-center flex-col rounded-md bg-opacity-50 bg-gray-800">
            <div class="text-lg">${icon}</div>
            <div class="text-xs font-semibold text-gray-300">${formatCardName(normalizedCard.name)}</div>
          </div>
        `;
      }
      
      pairElement.appendChild(cardElement);
    });
    
    elements.gameBoard.pairsContainer.appendChild(pairElement);
  });
  
  // Add placeholder if no pairs
  if (gameState.myPairs.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.classList.add('col-span-full', 'text-center', 'text-gray-400', 'py-4');
    placeholder.textContent = 'Nu ai format încă nicio pereche';
    elements.gameBoard.pairsContainer.appendChild(placeholder);
  }
}

function showNotification(message, type = 'success') {
  // Get the notification element
  const notification = elements.notification;
  
  // Set message
  elements.notificationText.textContent = message;
  
  // Set color based on type
  if (type === 'error') {
    notification.classList.add('error');
  } else {
    notification.classList.remove('error');
  }
  
  // Show notification with animation
  notification.classList.add('show');
  
  // Remove animation class after it finishes
  setTimeout(() => {
    notification.classList.remove('show');
  }, 4000);
}

// Add a utility function to normalize card data
function normalizeCardData(card) {
  // Make a copy to avoid modifying the original
  const normalizedCard = {...card};
  
  // Ensure name is lowercase for consistent comparison
  if (normalizedCard.name) {
    normalizedCard.name = normalizedCard.name.toLowerCase();
  }
  
  // Ensure type is one of the expected values
  if (normalizedCard.type && !['boy', 'girl', 'trickster'].includes(normalizedCard.type)) {
    console.warn(`[Normalize] Unexpected card type: ${normalizedCard.type}`);
  }
  
  return normalizedCard;
}

// Update isPair function to use normalized card data
function isPair(card1, card2) {
  // Normalize card data
  const normalizedCard1 = normalizeCardData(card1);
  const normalizedCard2 = normalizeCardData(card2);
  
  // Add debug logging
  console.log("[Pair Check]", 
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
  if (!gameState.isDeckEmpty) {
    console.log("[Render Skip] Deck is not empty, skipping renderOtherPlayersCards.");
    return;
  }
  
  // Create or update the container for other players' cards
  let otherPlayersContainer = document.getElementById('other-players-cards');
  
  if (!otherPlayersContainer) {
    otherPlayersContainer = document.createElement('div');
    otherPlayersContainer.id = 'other-players-cards';
    otherPlayersContainer.className = 'other-players-container';
    
    const heading = document.createElement('h2');
    heading.className = 'text-lg font-semibold mb-3 text-white';
    heading.textContent = 'Cărțile altor jucători';
    
    // Add rule-specific text
    const subtitleText = gameState.gameRules.nextPlayerOnly 
      ? 'Selectează o carte de la următorul jucător activ. Regula "Doar următorul jucător" este activă.'
      : 'Selectează o carte de la un jucător. Fiecare jucător își poate rearanja cărțile.';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'text-sm text-gray-400 mb-4';
    subtitle.textContent = subtitleText;
    
    otherPlayersContainer.appendChild(heading);
    otherPlayersContainer.appendChild(subtitle);
    
    // Insert after player cards
    const playerCardsContainer = document.querySelector('.bg-gray-800.rounded-lg.shadow-md.p-4.mb-4');
    if (playerCardsContainer) {
      playerCardsContainer.parentNode.insertBefore(otherPlayersContainer, playerCardsContainer.nextSibling);
    }
  }
  
  // Clear the container except the heading and subtitle
  while (otherPlayersContainer.childNodes.length > 2) {
    otherPlayersContainer.removeChild(otherPlayersContainer.lastChild);
  }
  
  // Get eligible players based on rules
  let eligiblePlayers = getEligiblePlayersForDraw();
  
  // Check if we need to request updated card info (less frequent now)
  if (eligiblePlayers.some(p => typeof p.cards !== 'number' || !p.cardPositions)) { 
    console.log("[Data Check] Requesting player card info as it seems outdated or missing...");
    requestOtherPlayersCards();
    return; // Avoid rendering with incomplete data
  }
  
  let hasPlayersWithCards = false;
  
  // Create a section for each eligible player
  eligiblePlayers.forEach(player => {
    const cardCount = player.cards;
    console.log(`[renderOtherPlayersCards] Rendering for ${player.username}, card count from gameState: ${cardCount}`);

    // Skip players with no cards
    if (cardCount === 0) return;
    
    hasPlayersWithCards = true;
    const playerSection = document.createElement('div');
    playerSection.className = 'other-player-section';
    
    // Add a rule indicator if this is the next player
    if (gameState.gameRules.nextPlayerOnly) {
      playerSection.classList.add('next-player');
    }
    
    const playerHeader = document.createElement('div');
    playerHeader.className = 'flex justify-between items-center mb-2';
    
    const playerName = document.createElement('h3');
    playerName.className = 'text-md font-medium text-white';
    playerName.innerHTML = `${player.username} <span class="text-gray-400">(${cardCount} cărți)</span>`;
    
    playerHeader.appendChild(playerName);
    
    // Add a selection indicator if this player is selected
    if (player.id === gameState.selectedPlayerForDraw) {
      const selectedIndicator = document.createElement('span');
      selectedIndicator.className = 'text-yellow-400 text-sm';
      selectedIndicator.textContent = 'Selectat';
      playerHeader.appendChild(selectedIndicator);
    }
    
    playerSection.appendChild(playerHeader);
    
    // Create a grid for the cards
    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'other-player-cards';
    
    // Create card backs based on the COUNT
    for (let i = 0; i < cardCount; i++) {
      const cardContainer = document.createElement('div');
      cardContainer.className = 'other-player-card-container';
      
      const cardBack = document.createElement('div');
      cardBack.className = 'other-player-card';
      cardBack.dataset.position = i; // Position is the index (0-based)
      
      // Add position number (displaying 1-based index)
      const positionNumber = document.createElement('div');
      positionNumber.className = 'card-position-number';
      positionNumber.textContent = i + 1;
      cardBack.appendChild(positionNumber);
      
      // Add animation effect to cards
      cardBack.style.animationDelay = `${i * 0.05}s`;
      
      // Check if this card position is selected
      if (player.id === gameState.selectedPlayerForDraw && i === gameState.selectedCardPosition) {
        cardBack.classList.add('selected');
      }
      
      // Add click handler to select this card position
      cardBack.addEventListener('click', () => {
        if (gameState.isMyTurn) {
          // Set the selected player and card position
          gameState.selectedPlayerForDraw = player.id;
          gameState.selectedCardPosition = i; // Store the 0-based index
          
          console.log(`Selected card at position ${i} from player ${player.username}`);

          // Update UI to show which card is selected
          document.querySelectorAll('.other-player-card').forEach(card => {
            card.classList.remove('selected');
          });
          
          cardBack.classList.add('selected');
          
          // Create or update the inline draw button
          updateInlineDrawButton(player.username, i);
          
          // Update the main draw button text
          if (elements.gameBoard.drawCardBtn) {
            elements.gameBoard.drawCardBtn.innerHTML = `<span>Trage cartea #${i + 1} de la ${player.username}</span>`;
          }
          
          // Show notification
          showNotification(`Ai selectat cartea #${i + 1} de la ${player.username}`);
        }
      });
      
      cardContainer.appendChild(cardBack);
      cardsGrid.appendChild(cardContainer);
    }
    
    playerSection.appendChild(cardsGrid);
    otherPlayersContainer.appendChild(playerSection);
  });
  
  // Add a container for the inline draw button
  const inlineDrawButtonContainer = document.createElement('div');
  inlineDrawButtonContainer.id = 'inline-draw-button-container';
  inlineDrawButtonContainer.className = 'inline-draw-button-container hidden';
  otherPlayersContainer.appendChild(inlineDrawButtonContainer);
  
  // Add instructions container if there are players with cards
  if (hasPlayersWithCards) {
      const instructionsContainer = document.createElement('div');
      instructionsContainer.className = 'mt-4 p-3 bg-gray-700 bg-opacity-50 rounded-md text-gray-300 text-sm game-instructions';
      instructionsContainer.innerHTML = `
        <p class="mb-2"><span class="font-semibold text-yellow-400">Cum se joacă:</span> Acum că pachetul este gol, fiecare jucător trebuie să tragă o carte de la ceilalți jucători.</p>
        <ul class="list-disc ml-5 space-y-1">
          <li>Selectează o carte (după număr) de la un jucător, apoi apasă "Trage cartea".</li>
          <li>Poți rearanja cărțile tale (trage și plasează) pentru a ascunde Păcăliciul.</li>
          <li>Jucătorul care rămâne doar cu Păcăliciul pierde.</li>
        </ul>
      `;
      otherPlayersContainer.appendChild(instructionsContainer);
  }
  
  // Add a message if no other players have cards
  if (!hasPlayersWithCards) {
    const message = document.createElement('p');
    message.className = 'text-center text-gray-400 py-4';
    message.textContent = 'Niciun alt jucător nu are cărți.';
    otherPlayersContainer.appendChild(message);
  }
  
  // If there's a currently selected card, display the inline draw button
  if (gameState.selectedPlayerForDraw !== null && gameState.selectedCardPosition !== null) {
    const selectedPlayer = gameState.players.find(p => p.id === gameState.selectedPlayerForDraw);
    if (selectedPlayer) {
      updateInlineDrawButton(selectedPlayer.username, gameState.selectedCardPosition);
    }
  }
}

// New function to handle the inline draw button
function updateInlineDrawButton(playerName, cardPosition) {
  const container = document.getElementById('inline-draw-button-container');
  if (!container) return;
  
  container.innerHTML = '';
  container.classList.remove('hidden');
  
  if (!gameState.isMyTurn) return;
  
  const drawBtn = document.createElement('button');
  drawBtn.className = 'control-btn draw-btn inline-draw-btn pulse-animation';
  drawBtn.innerHTML = `<span>Trage cartea #${cardPosition + 1} de la ${playerName}</span>`;
  
  drawBtn.addEventListener('click', () => {
    if (gameState.isMyTurn && gameState.selectedPlayerForDraw !== null && gameState.selectedCardPosition !== null) {
      // Draw specific card from player
      gameState.socket.emit('drawCardFromPlayer', {
        fromPlayerId: gameState.selectedPlayerForDraw,
        cardPosition: gameState.selectedCardPosition
      });
      
      // Keep the visual selection active until the server confirms the draw
      // The selected state will be cleared in the cardDrawn or error handlers
      
      // Only hide the button (but keep the card selected visually)
      container.classList.add('hidden');
    }
  });
  
  container.appendChild(drawBtn);
}

// Add a new function to render all players' pairs
function renderAllPlayersPairs() {
  // Get the container for all players' pairs
  let allPairsContainer = document.getElementById('all-players-pairs');
  
  // Create the container if it doesn't exist
  if (!allPairsContainer) {
    allPairsContainer = document.createElement('div');
    allPairsContainer.id = 'all-players-pairs';
    allPairsContainer.className = 'bg-gray-800 rounded-lg shadow-md p-4 mt-4';
    
    const heading = document.createElement('h2');
    heading.className = 'text-lg font-semibold mb-2 text-white';
    heading.textContent = 'Perechi formate de toți jucătorii';
    
    allPairsContainer.appendChild(heading);
    
    // Insert after pairs container
    const pairsContainer = document.querySelector('.bg-gray-800.rounded-lg.shadow-md.p-4');
    if (pairsContainer) {
      pairsContainer.parentNode.appendChild(allPairsContainer);
    }
  }
  
  // Clear existing content except the heading
  while (allPairsContainer.childNodes.length > 1) {
    allPairsContainer.removeChild(allPairsContainer.lastChild);
  }
  
  // Create a section for each player's pairs
  gameState.players.forEach(player => {
    if (player.pairs && player.pairs > 0) {
      const playerSection = document.createElement('div');
      playerSection.className = 'player-pairs-section';
      
      const playerName = document.createElement('h3');
      playerName.className = 'text-md font-medium text-white';
      playerName.textContent = `${player.username} - ${player.pairs} perechi`;
      
      playerSection.appendChild(playerName);
      
      // Create a visual representation of the pairs
      const pairsGrid = document.createElement('div');
      pairsGrid.className = 'player-pairs-grid mt-1';
      
      // If it's the current player, we have the actual pairs data
      if (player.id === gameState.playerId) {
        gameState.myPairs.forEach((pair, index) => {
          const pairItem = document.createElement('div');
          pairItem.className = 'player-pair-item';
          
          // Try to get the image for the card
          if (pair[0]) {
            // Normalize the card data
            const normalizedCard = normalizeCardData(pair[0]);
            
            if (normalizedCard.name !== 'pacalici' && cardImages[normalizedCard.name]) {
              // Use boy image for the pair visualization (conventionally)
              const cardImageSrc = cardImages[normalizedCard.name].boy;
              pairItem.innerHTML = `<img src="${cardImageSrc}" alt="${formatCardName(normalizedCard.name)}" class="h-8 w-8 object-contain">`;
            } else {
              // Fallback to emoji
              pairItem.innerHTML = cardIcons[normalizedCard.name] || '👥';
            }
          } else {
            // Default pair icon if no valid card data
            pairItem.innerHTML = '👥';
          }
          
          pairsGrid.appendChild(pairItem);
        });
      } else {
        // For other players, just show generic pair icons
        for (let i = 0; i < player.pairs; i++) {
          const pairItem = document.createElement('div');
          pairItem.className = 'player-pair-item';
          pairItem.innerHTML = '👥';
          pairsGrid.appendChild(pairItem);
        }
      }
      
      playerSection.appendChild(pairsGrid);
      allPairsContainer.appendChild(playerSection);
    }
  });
  
  // Add a message if no pairs have been formed
  if (allPairsContainer.childNodes.length <= 1) {
    const message = document.createElement('p');
    message.className = 'text-center text-gray-400 py-2';
    message.textContent = 'Niciun jucător nu a format perechi încă.';
    allPairsContainer.appendChild(message);
  }
}

// Simple sound effects function
function playSound(type) {
  try {
    // Create audio element or reuse existing one
    let audio = document.getElementById(`sound-${type}`);
    
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = `sound-${type}`;
      audio.preload = 'auto';
      document.body.appendChild(audio);
    }
    
    // Set the source based on the sound type
    switch (type) {
      case 'match':
        audio.src = '/sounds/match.wav';
        break;
      case 'draw':
        audio.src = '/sounds/tragecarte.wav';
        break;
      case 'turn':
        audio.src = '/sounds/schimba-tura.wav';
        break;
      case 'click':
        // Optional - future implementation
        return; // Skip for now as we're focusing only on specific sounds
      default:
        return; // Unknown sound type
    }
    
    // Play the sound
    audio.currentTime = 0; // Reset to beginning
    audio.play().catch(error => {
      console.log(`[Sound] Error playing ${type} sound:`, error);
    });
    
  } catch (error) {
    console.error('[Sound] Error in playSound function:', error);
  }
}

// Add a helper function to request other players' cards info
function requestOtherPlayersCards() {
  if (gameState.socket) {
    gameState.socket.emit('getPlayersCards');
  }
}

// Add a function to handle card rearrangement
function setupCardDragging() {
  // Only enable dragging of your own cards when the deck is empty
  if (!gameState.myCards || gameState.myCards.length <= 1) return;
  
  const cardElements = document.querySelectorAll('#player-cards .card');
  cardElements.forEach((card, index) => {
    card.setAttribute('draggable', 'true');
    card.dataset.index = index;
    
    // Add drag start event
    card.addEventListener('dragstart', function(e) {
      gameState.isDragging = true;
      gameState.draggedCardIndex = parseInt(this.dataset.index);
      
      this.classList.add('dragging');
      
      // Set data for drag operation
      e.dataTransfer.setData('text/plain', this.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
    });
    
    // Add dragover event to show where the card will be dropped
    card.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const draggedIndex = gameState.draggedCardIndex;
      const targetIndex = parseInt(this.dataset.index);
      
      if (draggedIndex !== targetIndex) {
        // Update the visual feedback
        cardElements.forEach(c => c.classList.remove('drag-over', 'drag-before', 'drag-after'));
        
        if (targetIndex < draggedIndex) {
          this.classList.add('drag-over', 'drag-before');
        } else {
          this.classList.add('drag-over', 'drag-after');
        }
      }
    });
    
    // Add drop event to rearrange cards
    card.addEventListener('drop', function(e) {
      e.preventDefault();
      
      // Get the indices
      const fromIndex = gameState.draggedCardIndex;
      const toIndex = parseInt(this.dataset.index);
      
      if (fromIndex === null || toIndex === null || fromIndex === toIndex) {
        // Cleanup visual feedback
        cardElements.forEach(c => c.classList.remove('drag-over', 'drag-before', 'drag-after'));
        return;
      }
      
      console.log(`Attempting to drop card from index ${fromIndex} to index ${toIndex}`);
      
      // Create an array representing the original indices [0, 1, 2, ...]
      const originalIndices = Array.from({ length: gameState.myCards.length }, (_, i) => i);
      
      // Simulate the move to get the new order of original indices
      const movedIndex = originalIndices.splice(fromIndex, 1)[0];
      originalIndices.splice(toIndex, 0, movedIndex);
      
      // The resulting array `originalIndices` is the `newOrder` the server expects
      const newOrder = originalIndices;

      console.log('Client sending newOrder:', newOrder);
      
      // Send the new order to the server
      gameState.socket.emit('rearrangeCards', { newOrder: newOrder });

      // Cleanup visual feedback immediately
      cardElements.forEach(c => c.classList.remove('drag-over', 'drag-before', 'drag-after'));
    });
    
    // Add dragend event to clean up
    card.addEventListener('dragend', function() {
      gameState.isDragging = false;
      gameState.draggedCardIndex = null;
      
      this.classList.remove('dragging');
      cardElements.forEach(c => c.classList.remove('drag-over', 'drag-before', 'drag-after'));
    });
  });
}

// Function to get eligible players based on rules
function getEligiblePlayersForDraw() {
  // Get all players who are not finished and still have cards
  const activePlayers = gameState.players.filter(p => 
    p.id !== gameState.playerId && !gameState.finishedPlayers.includes(p.id) && p.cards > 0
  );
  
  // If nextPlayerOnly rule is active, only allow drawing from the next player
  if (gameState.gameRules.nextPlayerOnly) {
    const currentPlayerIndex = gameState.players.findIndex(p => p.id === gameState.playerId);
    
    if (currentPlayerIndex !== -1) {
      // Find the next active player in turn order
      const totalPlayers = gameState.players.length;
      for (let i = 1; i < totalPlayers; i++) {
        const nextIndex = (currentPlayerIndex + i) % totalPlayers;
        const nextPlayer = gameState.players[nextIndex];
        
        if (nextPlayer && !gameState.finishedPlayers.includes(nextPlayer.id) && nextPlayer.cards > 0) {
          // Return only this player as eligible
          return [nextPlayer];
        }
      }
    }
    
    // No eligible next player found
    return [];
  }
  
  // If no special rule, return all active players
  return activePlayers;
}

// Helper function to map old card names to nationality cards
function mapOldCardNameToNew(oldName) {
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
    'gradinar': 'german'  // Fallback mapping
  };
  
  return nameMap[oldName.toLowerCase()] || oldName;
}

// Initialize the game when the page loads
window.addEventListener('load', initGame); 
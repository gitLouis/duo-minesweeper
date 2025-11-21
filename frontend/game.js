// WebSocket client and game coordination

class GameClient {
    constructor() {
        this.ws = null;
        this.gameId = null;
        this.playerId = null;
        this.playerName = null;
        this.currentPlayer = null;
        this.gameState = null;
        this.board = new MinesweeperBoard('game-board');
        this.timer = 0;
        this.timerInterval = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.playerColors = {
            'player1': '#3b82f6', // Blue
            'player2': '#ef4444'  // Red
        };
        this.playerTimeTrackers = {
            'player1': { startTime: null, totalTime: 0 },
            'player2': { startTime: null, totalTime: 0 }
        };
        
        this.init();
    }

    init() {
        // Check if joining via URL
        const urlParams = new URLSearchParams(window.location.search);
        const gameIdFromUrl = urlParams.get('game');
        if (gameIdFromUrl) {
            document.getElementById('game-id-input').value = gameIdFromUrl;
        }

        // Setup event listeners
        document.getElementById('create-game-btn').addEventListener('click', () => this.createGame());
        document.getElementById('join-game-btn').addEventListener('click', () => this.joinGame());
        document.getElementById('copy-link-btn').addEventListener('click', () => this.copyShareLink());
        document.getElementById('play-again-btn').addEventListener('click', () => this.resetGame());
        document.getElementById('close-game-over-btn').addEventListener('click', () => this.closeGameOver());
        document.getElementById('exit-game-btn').addEventListener('click', () => this.exitToMainMenu());
        
        // Show/hide custom difficulty inputs
        document.getElementById('difficulty-select').addEventListener('change', (e) => {
            const customInputs = document.getElementById('custom-difficulty-inputs');
            if (e.target.value === 'custom') {
                customInputs.classList.remove('hidden');
            } else {
                customInputs.classList.add('hidden');
            }
        });

        // Board click handlers
        this.board.onCellClick = (row, col) => this.handleCellClick(row, col);
        this.board.onCellRightClick = (row, col) => this.handleCellRightClick(row, col);

        // Update connection status
        this.updateConnectionStatus('disconnected', 'Disconnected');
    }

    getWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}/ws`;
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        this.updateConnectionStatus('connecting', 'Connecting...');
        
        try {
            this.ws = new WebSocket(this.getWebSocketUrl());
            
            this.ws.onopen = () => {
                this.updateConnectionStatus('connected', 'Connected');
                this.reconnectAttempts = 0;
                console.log('WebSocket connected');
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('disconnected', 'Connection Error');
            };

            this.ws.onclose = () => {
                this.updateConnectionStatus('disconnected', 'Disconnected');
                console.log('WebSocket disconnected');
                
                // Attempt to reconnect if we were in a game
                if (this.gameId && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    setTimeout(() => {
                        console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
                        this.connect();
                        if (this.gameId && this.playerId) {
                            // Rejoin the game
                            this.sendMessage({
                                type: 'join',
                                gameId: this.gameId,
                                playerName: this.playerName
                            });
                        }
                    }, 2000);
                }
            };
        } catch (error) {
            console.error('Failed to connect:', error);
            this.updateConnectionStatus('disconnected', 'Connection Failed');
        }
    }

    updateConnectionStatus(status, text) {
        const indicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        
        indicator.className = `status-indicator ${status}`;
        statusText.textContent = text;
    }

    sendMessage(message) {
        console.log('Sending message:', message, 'WebSocket state:', this.ws?.readyState);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            console.log('Message sent successfully');
        } else {
            console.error('WebSocket not connected. State:', this.ws?.readyState);
        }
    }

    async createGame() {
        const difficulty = document.getElementById('difficulty-select').value;
        const gameMode = document.getElementById('game-mode-select').value;
        const playerName = document.getElementById('create-player-name').value.trim() || 'Player 1';
        
        let url = `/api/create-game?difficulty=${difficulty}&game_mode=${gameMode}`;
        
        // Add custom parameters if custom difficulty is selected
        if (difficulty === 'custom') {
            const rows = parseInt(document.getElementById('custom-rows').value);
            const cols = parseInt(document.getElementById('custom-cols').value);
            const mines = parseInt(document.getElementById('custom-mines').value);
            
            // Validate custom inputs
            if (!rows || rows < 5 || rows > 50) {
                alert('Rows must be between 5 and 50');
                return;
            }
            if (!cols || cols < 5 || cols > 50) {
                alert('Columns must be between 5 and 50');
                return;
            }
            if (!mines || mines < 1) {
                alert('Mines must be at least 1');
                return;
            }
            const maxMines = rows * cols - 9; // Leave at least 9 cells safe (for first click and neighbors)
            if (mines > maxMines) {
                alert(`Too many mines! Maximum is ${maxMines} for a ${rows}x${cols} board`);
                return;
            }
            
            url += `&rows=${rows}&cols=${cols}&mines=${mines}`;
        }
        
        try {
            const response = await fetch(url, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.error) {
                alert('Error: ' + data.error);
                return;
            }
            
            if (data.game_id) {
                this.gameId = data.game_id;
                this.playerName = playerName;
                this.updateShareLink();
                this.connect();
                
                // Wait a bit for connection, then join
                setTimeout(() => {
                    this.sendMessage({
                        type: 'join',
                        gameId: this.gameId,
                        playerName: playerName
                    });
                }, 500);
            }
        } catch (error) {
            console.error('Failed to create game:', error);
            alert('Failed to create game. Please try again.');
        }
    }

    async joinGame() {
        let gameId = document.getElementById('game-id-input').value.trim();
        
        // Extract game ID from URL if it's a full link
        if (gameId.includes('/game/')) {
            const match = gameId.match(/\/game\/([a-zA-Z0-9-]+)/);
            if (match) {
                gameId = match[1];
            }
        }
        
        if (!gameId) {
            alert('Please enter a game ID');
            return;
        }

        // Check if game exists
        try {
            const response = await fetch(`/api/game/${gameId}/status`);
            const data = await response.json();
            
            if (!data.exists) {
                alert('Game not found. Please check the game ID.');
                return;
            }
            
            if (data.players_count >= 2) {
                alert('Game is full. Please create a new game.');
                return;
            }

            const playerName = document.getElementById('join-player-name').value.trim() || 'Player 2';
            this.gameId = gameId;
            this.playerName = playerName;
            this.updateShareLink();
            this.connect();
            
            // Wait a bit for connection, then join
            setTimeout(() => {
                this.sendMessage({
                    type: 'join',
                    gameId: this.gameId,
                    playerName: playerName
                });
            }, 500);
        } catch (error) {
            console.error('Failed to join game:', error);
            alert('Failed to join game. Please try again.');
        }
    }

    updateShareLink() {
        const shareLink = `${window.location.origin}${window.location.pathname}?game=${this.gameId}`;
        document.getElementById('share-link').value = shareLink;
    }

    copyShareLink() {
        const shareLinkInput = document.getElementById('share-link');
        shareLinkInput.select();
        shareLinkInput.setSelectionRange(0, 99999); // For mobile
        
        try {
            document.execCommand('copy');
            const btn = document.getElementById('copy-link-btn');
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    handleMessage(message) {
        console.log('Received message:', message);

        switch (message.type) {
            case 'joined':
                this.playerId = message.player_id;
                this.gameId = message.game_id;
                this.updateGameState(message.game_state);
                this.showGameSection();
                break;

            case 'player_joined':
                if (message.game_state) {
                    this.updateGameState(message.game_state);
                }
                this.updatePlayersInfo(message.players);
                break;

            case 'action_result':
                console.log('Action result received:', message);
                
                // If a mine was hit, immediately show the explosion
                if (message.result && message.result.mine_hit && message.row !== undefined && message.col !== undefined) {
                    const playerId = message.player_id || message.result.player_id;
                    this.board.showMineExplosion(message.row, message.col, playerId);
                } else {
                    // Show click indicator with player color for non-mine clicks
                    if (message.player_id && message.row !== undefined && message.col !== undefined) {
                        this.board.showClickIndicator(message.row, message.col, message.player_id);
                    }
                }
                
                if (message.game_state) {
                    this.updateGameState(message.game_state);
                }
                if (message.current_player) {
                    this.updateCurrentPlayer(message.current_player);
                }
                if (message.player_stats) {
                    this.updatePlayerStats(message.player_stats);
                }
                break;

            case 'game_over':
                this.handleGameOver(message.won, message.reason);
                break;

            case 'game_state':
                this.updateGameState(message.game_state);
                break;

            case 'player_disconnected':
                alert('Other player disconnected. Waiting for reconnection...');
                break;

            case 'error':
                alert('Error: ' + message.message);
                break;

            default:
                console.log('Unknown message type:', message.type);
        }
    }

    updateGameState(gameState) {
        if (!gameState || !gameState.game_state) {
            return;
        }

        this.gameState = gameState.game_state;
        this.currentPlayer = gameState.current_player;

        // Update board
        if (this.gameState.board) {
            if (!this.board.board) {
                this.board.createBoard(this.gameState.rows, this.gameState.cols);
            }
            // Pass full game state to board for mine hit tracking
            const boardStateWithHits = {
                ...this.gameState,
                mine_hit_by_player: gameState.game_state?.mine_hit_by_player || {}
            };
            this.board.updateBoard(boardStateWithHits);
        }

        // Update UI
        document.getElementById('mines-count').textContent = this.gameState.mines;
        document.getElementById('flags-count').textContent = this.gameState.flagged_count;
        this.updateCurrentPlayer(this.currentPlayer);
        this.updatePlayersInfo(gameState.players);

        // Enable/disable board based on turn
        const isMyTurn = this.currentPlayer === this.playerId;
        const canPlay = this.gameState.status === 'playing' || this.gameState.status === 'waiting';
        this.board.setDisabled(!isMyTurn || !canPlay);

        // Start/stop timer
        if (this.gameState.status === 'playing' && !this.timerInterval) {
            this.startTimer();
        } else if (this.gameState.status !== 'playing' && this.timerInterval) {
            this.stopTimer();
        }
    }

    updateCurrentPlayer(currentPlayer) {
        this.currentPlayer = currentPlayer;
        const turnText = document.getElementById('turn-text');
        const turnIndicator = document.getElementById('turn-indicator');
        
        if (!currentPlayer) {
            turnText.textContent = 'Waiting for players...';
            turnIndicator.style.backgroundColor = '#667eea';
        } else if (currentPlayer === this.playerId) {
            turnText.textContent = 'Your turn!';
            turnIndicator.style.backgroundColor = this.playerColors[this.playerId];
        } else {
            turnText.textContent = "Opponent's turn...";
            const opponentId = currentPlayer === 'player1' ? 'player2' : 'player1';
            turnIndicator.style.backgroundColor = this.playerColors[opponentId];
        }
    }

    updatePlayersInfo(players) {
        if (!players) {
            return;
        }

        const player1Info = document.getElementById('player1-info');
        const player2Info = document.getElementById('player2-info');
        const player1Status = document.getElementById('player1-status');
        const player2Status = document.getElementById('player2-status');

        if (players.player1) {
            const playerNameEl = player1Info.querySelector('.player-name');
            playerNameEl.textContent = players.player1;
            playerNameEl.style.color = this.playerColors.player1;
            player1Info.classList.remove('waiting');
            player1Info.style.borderColor = this.playerColors.player1;
            if (this.currentPlayer === 'player1') {
                player1Info.classList.add('active');
                player1Status.textContent = 'Active';
            } else {
                player1Info.classList.remove('active');
                player1Status.textContent = 'Waiting';
            }
        } else {
            player1Info.classList.add('waiting');
            player1Status.textContent = 'Not joined';
        }

        if (players.player2) {
            const playerNameEl = player2Info.querySelector('.player-name');
            playerNameEl.textContent = players.player2;
            playerNameEl.style.color = this.playerColors.player2;
            player2Info.classList.remove('waiting');
            player2Info.style.borderColor = this.playerColors.player2;
            if (this.currentPlayer === 'player2') {
                player2Info.classList.add('active');
                player2Status.textContent = 'Active';
            } else {
                player2Info.classList.remove('active');
                player2Status.textContent = 'Waiting';
            }
        } else {
            player2Info.classList.add('waiting');
            player2Status.textContent = 'Not joined';
        }
    }

    updatePlayerStats(playerStats) {
        if (!playerStats) {
            return;
        }

        // Update Player 1 stats
        if (playerStats.player1) {
            const stats = playerStats.player1;
            document.getElementById('player1-exploded-mines').textContent = stats.mines_hit || 0;
            document.getElementById('player1-exposed-mines').textContent = stats.mines_flagged || 0;
            document.getElementById('player1-land-explored').textContent = stats.cells_revealed || 0;
            const timePlayed = Math.floor(stats.time_played || 0);
            document.getElementById('player1-time').textContent = `${timePlayed}s`;
            
            // Update side panel name
            const player1Name = this.gameState?.players?.player1 || 'Player 1';
            document.getElementById('player1-side-name').textContent = player1Name;
        }

        // Update Player 2 stats
        if (playerStats.player2) {
            const stats = playerStats.player2;
            document.getElementById('player2-exploded-mines').textContent = stats.mines_hit || 0;
            document.getElementById('player2-exposed-mines').textContent = stats.mines_flagged || 0;
            document.getElementById('player2-land-explored').textContent = stats.cells_revealed || 0;
            const timePlayed = Math.floor(stats.time_played || 0);
            document.getElementById('player2-time').textContent = `${timePlayed}s`;
            
            // Update side panel name
            const player2Name = this.gameState?.players?.player2 || 'Player 2';
            document.getElementById('player2-side-name').textContent = player2Name;
        }
    }

    handleCellClick(row, col) {
        console.log('Cell clicked:', row, col, 'Current player:', this.currentPlayer, 'My player:', this.playerId, 'Status:', this.gameState?.status);
        
        if (this.currentPlayer !== this.playerId) {
            console.log('Not your turn');
            return;
        }
        if (this.gameState.status !== 'playing' && this.gameState.status !== 'waiting') {
            console.log('Game not in playable state:', this.gameState.status);
            return;
        }

        console.log('Sending reveal message');
        this.sendMessage({
            type: 'reveal',
            gameId: this.gameId,
            row: row,
            col: col
        });
    }

    handleCellRightClick(row, col) {
        if (this.currentPlayer !== this.playerId) {
            return;
        }
        if (this.gameState.status !== 'playing' && this.gameState.status !== 'waiting') {
            return;
        }

        this.sendMessage({
            type: 'flag',
            gameId: this.gameId,
            row: row,
            col: col
        });
    }

    handleGameOver(won, reason) {
        this.stopTimer();
        this.board.setDisabled(true);

        // Reveal all mines
        if (this.gameState && this.gameState.mine_positions) {
            this.board.revealAllMines(this.gameState.mine_positions);
        }

        const gameOverDisplay = document.getElementById('game-over-display');
        const title = document.getElementById('game-over-title');
        const gif = document.getElementById('game-over-gif');

        if (won) {
            title.textContent = '🎉 You Won! 🎉';
            // Funny winning GIF - celebration
            gif.src = 'https://media.giphy.com/media/3o7aCTPPm4OHfRLSH6/giphy.gif';
        } else {
            title.textContent = '💥 Game Over 💥';
            // Funny losing GIF - explosion/fail
            gif.src = 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif';
        }
        
        // Fallback if GIF fails to load
        gif.onerror = function() {
            this.src = won 
                ? 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif' // Alternative win GIF
                : 'https://media.giphy.com/media/3o7aD2saQ8lYeC8V4s/giphy.gif'; // Alternative fail GIF
        };

        gameOverDisplay.classList.remove('hidden');
    }

    showGameSection() {
        document.getElementById('setup-section').classList.add('hidden');
        document.getElementById('game-section').classList.remove('hidden');
    }

    closeGameOver() {
        document.getElementById('game-over-display').classList.add('hidden');
    }

    exitToMainMenu() {
        if (confirm('Are you sure you want to exit the game? This will disconnect you from the current game.')) {
            this.closeGameOver();
            this.gameId = null;
            this.playerId = null;
            this.currentPlayer = null;
            this.gameState = null;
            this.stopTimer();
            this.timer = 0;
            document.getElementById('timer').textContent = '0';
            
            if (this.board) {
                this.board.reset();
            }

            // Close WebSocket connection
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            
            // Reset connection status
            this.updateConnectionStatus('disconnected', 'Disconnected');
            
            // Show setup section, hide game section
            document.getElementById('setup-section').classList.remove('hidden');
            document.getElementById('game-section').classList.add('hidden');
            
            // Clear input fields
            document.getElementById('create-player-name').value = '';
            document.getElementById('join-player-name').value = '';
            document.getElementById('game-id-input').value = '';
        }
    }

    resetGame() {
        this.closeGameOver();
        this.gameId = null;
        this.playerId = null;
        this.currentPlayer = null;
        this.gameState = null;
        this.stopTimer();
        this.timer = 0;
        document.getElementById('timer').textContent = '0';
        
        if (this.board) {
            this.board.reset();
        }

        document.getElementById('setup-section').classList.remove('hidden');
        document.getElementById('game-section').classList.add('hidden');
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    startTimer() {
        this.timer = 0;
        this.timerInterval = setInterval(() => {
            this.timer++;
            document.getElementById('timer').textContent = this.timer;
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
}

// Initialize game client when page loads
let gameClient;
document.addEventListener('DOMContentLoaded', () => {
    gameClient = new GameClient();
});


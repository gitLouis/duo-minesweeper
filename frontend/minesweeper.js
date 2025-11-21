// Client-side Minesweeper board rendering and interactions

class MinesweeperBoard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.board = null;
        this.rows = 0;
        this.cols = 0;
        this.onCellClick = null;
        this.onCellRightClick = null;
        this.disabled = false;
        this.playerColors = {
            'player1': '#3b82f6', // Blue
            'player2': '#ef4444'  // Red
        };
    }

    createBoard(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.container.innerHTML = '';
        this.container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        this.board = [];

        for (let r = 0; r < rows; r++) {
            this.board[r] = [];
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                // Left click (reveal)
                cell.addEventListener('click', () => {
                    if (!this.disabled && this.onCellClick) {
                        this.onCellClick(parseInt(cell.dataset.row), parseInt(cell.dataset.col));
                    }
                });

                // Right click (flag)
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (!this.disabled && this.onCellRightClick) {
                        this.onCellRightClick(parseInt(cell.dataset.row), parseInt(cell.dataset.col));
                    }
                });

                this.container.appendChild(cell);
                this.board[r][c] = cell;
            }
        }
    }

    updateBoard(boardState) {
        if (!this.board || !boardState || !boardState.board) {
            return;
        }

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.board[r][c];
                const cellData = boardState.board[r][c];

                // Reset cell classes but preserve mine explosion styles
                const isMineExplosion = cell.classList.contains('mine') && cell.textContent === '💥';
                const preservedStyles = isMineExplosion ? {
                    borderColor: cell.style.borderColor,
                    borderWidth: cell.style.borderWidth,
                    backgroundColor: cell.style.backgroundColor,
                    opacity: cell.style.opacity
                } : null;
                
                cell.className = 'cell';
                cell.textContent = '';
                
                // Restore preserved styles if it was a mine explosion
                if (preservedStyles) {
                    cell.style.borderColor = preservedStyles.borderColor;
                    cell.style.borderWidth = preservedStyles.borderWidth;
                    cell.style.backgroundColor = preservedStyles.backgroundColor;
                    cell.style.opacity = preservedStyles.opacity;
                }

                if (cellData.state === 'revealed') {
                    cell.classList.add('revealed');
                    const value = cellData.value;
                    
                    if (value === -1) {
                        // Mine - check if we know which player hit it
                        cell.classList.add('mine');
                        // Check if this mine was hit by a player (for explosion color)
                        const mineKey = `${r},${c}`;
                        const hitByPlayer = boardState.mine_hit_by_player && boardState.mine_hit_by_player[mineKey];
                        if (hitByPlayer) {
                            const playerColors = {
                                'player1': '#3b82f6',
                                'player2': '#ef4444'
                            };
                            const color = playerColors[hitByPlayer] || '#f44336';
                            cell.style.borderColor = color;
                            cell.style.borderWidth = '3px';
                            cell.style.backgroundColor = color;
                            cell.style.opacity = '0.8';
                        } else {
                            // If no player info, use default red
                            cell.style.borderColor = '#f44336';
                            cell.style.borderWidth = '3px';
                            cell.style.backgroundColor = '#f44336';
                            cell.style.opacity = '0.8';
                        }
                        cell.textContent = '💥'; // Explosion emoji
                    } else if (value > 0) {
                        // Number
                        cell.classList.add(`number-${value}`);
                        cell.textContent = value;
                    }
                    // value === 0 means empty, no text
                } else if (cellData.state === 'flagged') {
                    cell.classList.add('flagged');
                    cell.textContent = '🚩';
                }
            }
        }
    }

    revealCell(row, col, value) {
        if (!this.board || row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
            return;
        }

        const cell = this.board[row][col];
        cell.classList.add('revealed');
        cell.classList.remove('flagged');

        if (value === -1) {
            cell.classList.add('mine');
            cell.textContent = '💣';
        } else if (value > 0) {
            cell.classList.add(`number-${value}`);
            cell.textContent = value;
        }
    }

    toggleFlag(row, col) {
        if (!this.board || row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
            return;
        }

        const cell = this.board[row][col];
        if (cell.classList.contains('revealed')) {
            return;
        }

        if (cell.classList.contains('flagged')) {
            cell.classList.remove('flagged');
            cell.textContent = '';
        } else {
            cell.classList.add('flagged');
            cell.textContent = '🚩';
        }
    }

    revealAllMines(minePositions) {
        if (!this.board || !minePositions) {
            return;
        }

        minePositions.forEach(([row, col]) => {
            if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
                const cell = this.board[row][col];
                if (!cell.classList.contains('revealed')) {
                    cell.classList.add('revealed', 'mine');
                    cell.textContent = '💣';
                }
            }
        });
    }

    setDisabled(disabled) {
        this.disabled = disabled;
        if (!this.board) {
            return;
        }

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.board[r][c];
                if (disabled) {
                    cell.classList.add('disabled');
                } else {
                    cell.classList.remove('disabled');
                }
            }
        }
    }

    showClickIndicator(row, col, playerId) {
        if (!this.board || row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
            return;
        }

        const cell = this.board[row][col];
        const color = this.playerColors[playerId] || '#666';
        
        // Add click indicator class and color
        cell.classList.add('click-indicator');
        cell.style.setProperty('--click-color', color);
        cell.style.borderColor = color;
        cell.style.borderWidth = '3px';
        
        // Remove indicator after animation
        setTimeout(() => {
            cell.classList.remove('click-indicator');
            // Reset border if cell is not revealed
            if (!cell.classList.contains('revealed')) {
                cell.style.borderColor = '';
                cell.style.borderWidth = '';
            } else {
                // Keep a subtle border color for revealed cells
                cell.style.borderColor = color;
                cell.style.borderWidth = '2px';
            }
        }, 1000);
    }

    showMineExplosion(row, col, playerId) {
        if (!this.board || row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
            return;
        }

        const cell = this.board[row][col];
        const color = this.playerColors[playerId] || '#f44336';
        
        // Immediately show the explosion
        cell.classList.add('revealed', 'mine');
        cell.textContent = '💥';
        cell.style.borderColor = color;
        cell.style.borderWidth = '3px';
        cell.style.backgroundColor = color;
        cell.style.opacity = '0.8';
        
        // Add explosion animation
        cell.style.animation = 'explosionPulse 0.5s ease-out';
        
        // Remove animation after it completes
        setTimeout(() => {
            cell.style.animation = '';
        }, 500);
    }

    reset() {
        if (!this.board) {
            return;
        }

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.board[r][c];
                cell.className = 'cell';
                cell.textContent = '';
                cell.style.borderColor = '';
                cell.style.borderWidth = '';
            }
        }
    }
}


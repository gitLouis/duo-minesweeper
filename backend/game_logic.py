import random
from typing import List, Tuple, Set, Optional, Dict
from enum import Enum


class CellState(Enum):
    HIDDEN = "hidden"
    REVEALED = "revealed"
    FLAGGED = "flagged"


class GameStatus(Enum):
    WAITING = "waiting"
    PLAYING = "playing"
    WON = "won"
    LOST = "lost"


class MinesweeperGame:
    def __init__(self, rows: int = 16, cols: int = 16, mines: int = 40, game_mode: str = "classic"):
        self.rows = rows
        self.cols = cols
        self.mines = mines
        self.game_mode = game_mode
        self.board = [[0 for _ in range(cols)] for _ in range(rows)]
        self.cell_states = [[CellState.HIDDEN for _ in range(cols)] for _ in range(rows)]
        self.mine_positions: Set[Tuple[int, int]] = set()
        self.revealed_count = 0
        self.flagged_count = 0
        self.status = GameStatus.WAITING
        self.first_click = True
        self.mine_hits: Set[Tuple[int, int]] = set()  # Track which mines have been hit
        self.mine_hit_by_player: Dict[Tuple[int, int], str] = {}  # Track which player hit which mine
        
    def place_mines(self, exclude_row: int, exclude_col: int):
        """Place mines randomly, excluding the first clicked cell and its neighbors."""
        exclude_positions = set()
        exclude_positions.add((exclude_row, exclude_col))
        # Exclude neighbors of first click
        for dr in [-1, 0, 1]:
            for dc in [-1, 0, 1]:
                nr, nc = exclude_row + dr, exclude_col + dc
                if 0 <= nr < self.rows and 0 <= nc < self.cols:
                    exclude_positions.add((nr, nc))
        
        available_positions = [
            (r, c) for r in range(self.rows) for c in range(self.cols)
            if (r, c) not in exclude_positions
        ]
        
        mine_positions = random.sample(available_positions, min(self.mines, len(available_positions)))
        self.mine_positions = set(mine_positions)
        
        # Update board with mine counts
        for r, c in self.mine_positions:
            self.board[r][c] = -1  # -1 represents a mine
        
        # Calculate numbers for each cell
        for r in range(self.rows):
            for c in range(self.cols):
                if self.board[r][c] != -1:
                    count = sum(
                        1 for dr in [-1, 0, 1] for dc in [-1, 0, 1]
                        if (r + dr, c + dc) in self.mine_positions
                    )
                    self.board[r][c] = count
    
    def reveal_cell(self, row: int, col: int, player_id: str = None) -> dict:
        """Reveal a cell and return the result."""
        if not (0 <= row < self.rows and 0 <= col < self.cols):
            return {"error": "Invalid cell coordinates"}
        
        if self.cell_states[row][col] == CellState.REVEALED:
            return {"error": "Cell already revealed"}
        
        if self.cell_states[row][col] == CellState.FLAGGED:
            return {"error": "Cannot reveal flagged cell"}
        
        if self.status != GameStatus.PLAYING and self.status != GameStatus.WAITING:
            return {"error": "Game is not in play"}
        
        # Place mines on first click
        if self.first_click:
            self.place_mines(row, col)
            self.status = GameStatus.PLAYING
            self.first_click = False
        
        # Check if it's a mine
        if (row, col) in self.mine_positions:
            self.cell_states[row][col] = CellState.REVEALED
            self.mine_hits.add((row, col))
            if player_id:
                self.mine_hit_by_player[(row, col)] = player_id
            
            # In survival mode, don't end the game, just mark the mine as hit
            if self.game_mode == "survival":
                return {
                    "result": "mine",
                    "game_over": False,
                    "mine_hit": True,
                    "switch_turn": True,
                    "player_id": player_id
                }
            else:
                # Classic mode: end the game
                self.status = GameStatus.LOST
                return {
                    "result": "mine",
                    "game_over": True,
                    "won": False,
                    "player_id": player_id
                }
        
        # Track cells revealed before flood fill
        cells_revealed_before = self.revealed_count
        
        # Reveal cell and flood fill if empty
        self._reveal_cell_recursive(row, col)
        
        # Calculate how many cells were revealed (including flood fill)
        cells_revealed_count = self.revealed_count - cells_revealed_before
        
        # Check win condition
        total_cells = self.rows * self.cols
        if self.game_mode == "survival":
            # In survival mode, win when all non-mine cells are revealed
            if self.revealed_count == total_cells - self.mines:
                self.status = GameStatus.WON
                return {
                    "result": "win",
                    "game_over": True,
                    "won": True,
                    "cells_revealed": cells_revealed_count
                }
        else:
            # Classic mode: win when all non-mine cells are revealed
            if self.revealed_count == total_cells - self.mines:
                self.status = GameStatus.WON
                return {
                    "result": "win",
                    "game_over": True,
                    "won": True,
                    "cells_revealed": cells_revealed_count
                }
        
        return {
            "result": "number",
            "value": self.board[row][col],
            "game_over": False,
            "cells_revealed": cells_revealed_count
        }
    
    def _reveal_cell_recursive(self, row: int, col: int):
        """Recursively reveal cells using flood fill algorithm."""
        if not (0 <= row < self.rows and 0 <= col < self.cols):
            return
        
        if self.cell_states[row][col] == CellState.REVEALED:
            return
        
        if self.cell_states[row][col] == CellState.FLAGGED:
            return
        
        if (row, col) in self.mine_positions:
            return
        
        self.cell_states[row][col] = CellState.REVEALED
        self.revealed_count += 1
        
        # If cell is empty (0), reveal neighbors
        if self.board[row][col] == 0:
            for dr in [-1, 0, 1]:
                for dc in [-1, 0, 1]:
                    if dr == 0 and dc == 0:
                        continue
                    self._reveal_cell_recursive(row + dr, col + dc)
    
    def toggle_flag(self, row: int, col: int) -> dict:
        """Toggle flag on a cell."""
        if not (0 <= row < self.rows and 0 <= col < self.cols):
            return {"error": "Invalid cell coordinates"}
        
        if self.cell_states[row][col] == CellState.REVEALED:
            return {"error": "Cannot flag revealed cell"}
        
        if self.status != GameStatus.PLAYING and self.status != GameStatus.WAITING:
            return {"error": "Game is not in play"}
        
        if self.cell_states[row][col] == CellState.FLAGGED:
            self.cell_states[row][col] = CellState.HIDDEN
            self.flagged_count -= 1
            return {"result": "unflagged"}
        else:
            self.cell_states[row][col] = CellState.FLAGGED
            self.flagged_count += 1
            return {"result": "flagged"}
    
    def get_serialized_state(self, hide_mines: bool = True) -> dict:
        """Get serialized game state for client."""
        board_state = []
        for r in range(self.rows):
            row = []
            for c in range(self.cols):
                cell = {
                    "state": self.cell_states[r][c].value,
                    "value": self.board[r][c]
                }
                # Hide mine positions unless game is over
                if hide_mines and self.status == GameStatus.PLAYING:
                    if (r, c) in self.mine_positions:
                        cell["value"] = 0  # Hide mine value
                row.append(cell)
            board_state.append(row)
        
        return {
            "rows": self.rows,
            "cols": self.cols,
            "board": board_state,
            "mines": self.mines,
            "flagged_count": self.flagged_count,
            "revealed_count": self.revealed_count,
            "status": self.status.value,
            "mine_positions": list(self.mine_positions) if self.status != GameStatus.PLAYING else [],
            "mine_hits": list(self.mine_hits) if self.game_mode == "survival" else [],
            "mine_hit_by_player": {f"{r},{c}": pid for (r, c), pid in self.mine_hit_by_player.items()}
        }


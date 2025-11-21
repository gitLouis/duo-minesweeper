import uuid
import time
from typing import Dict, Optional
from game_logic import MinesweeperGame, GameStatus


class GameManager:
    def __init__(self):
        self.games: Dict[str, dict] = {}
        self.player_sessions: Dict[str, str] = {}  # session_id -> game_id
        self.game_timeout = 3600  # 1 hour in seconds
    
    def create_game(self, difficulty: str = "medium", game_mode: str = "classic", rows: int = None, cols: int = None, mines: int = None) -> dict:
        """Create a new game and return game info."""
        game_id = str(uuid.uuid4())[:8]  # Short 8-character ID
        
        # Set difficulty parameters
        if difficulty == "custom":
            # Validate custom parameters
            if rows is None or cols is None or mines is None:
                return {"error": "Custom difficulty requires rows, cols, and mines parameters"}
            if rows < 5 or rows > 50:
                return {"error": "Rows must be between 5 and 50"}
            if cols < 5 or cols > 50:
                return {"error": "Columns must be between 5 and 50"}
            if mines < 1:
                return {"error": "Mines must be at least 1"}
            max_mines = rows * cols - 9  # Leave at least 9 cells safe
            if mines > max_mines:
                return {"error": f"Too many mines! Maximum is {max_mines} for a {rows}x{cols} board"}
            
            config = {"rows": rows, "cols": cols, "mines": mines}
        else:
            difficulty_configs = {
                "easy": {"rows": 9, "cols": 9, "mines": 10},
                "medium": {"rows": 16, "cols": 16, "mines": 40},
                "hard": {"rows": 16, "cols": 30, "mines": 99}
            }
            config = difficulty_configs.get(difficulty, difficulty_configs["medium"])
        
        game = MinesweeperGame(**config, game_mode=game_mode)
        
        self.games[game_id] = {
            "game": game,
            "players": {},
            "current_player": None,
            "created_at": time.time(),
            "last_activity": time.time(),
            "game_mode": game_mode,
            "player_stats": {
                "player1": {"mines_hit": 0, "cells_revealed": 0, "time_played": 0, "mines_flagged": 0},
                "player2": {"mines_hit": 0, "cells_revealed": 0, "time_played": 0, "mines_flagged": 0}
            },
            "player_turn_start": {}  # Track when each player's turn started
        }
        
        return {
            "game_id": game_id,
            "difficulty": difficulty,
            "game_mode": game_mode,
            "config": config
        }
    
    def join_game(self, game_id: str, session_id: str, player_name: str = None) -> dict:
        """Join a game as a player."""
        if game_id not in self.games:
            return {"error": "Game not found"}
        
        game_data = self.games[game_id]
        
        if len(game_data["players"]) >= 2:
            return {"error": "Game is full"}
        
        # Assign player number
        if "player1" not in game_data["players"]:
            player_id = "player1"
        else:
            player_id = "player2"
        
        game_data["players"][player_id] = {
            "session_id": session_id,
            "name": player_name or f"Player {player_id[-1]}",
            "joined_at": time.time()
        }
        
        self.player_sessions[session_id] = game_id
        
        # Set first player as current if this is the first player
        if game_data["current_player"] is None:
            game_data["current_player"] = "player1"
        
        # Start game if both players joined
        if len(game_data["players"]) == 2:
            game_data["game"].status = GameStatus.WAITING
        
        game_data["last_activity"] = time.time()
        
        return {
            "player_id": player_id,
            "game_id": game_id,
            "players": {pid: p["name"] for pid, p in game_data["players"].items()}
        }
    
    def get_game(self, game_id: str) -> Optional[dict]:
        """Get game data."""
        if game_id not in self.games:
            return None
        return self.games[game_id]
    
    def get_player_game(self, session_id: str) -> Optional[tuple]:
        """Get game_id and player_id for a session."""
        game_id = self.player_sessions.get(session_id)
        if not game_id:
            return None
        
        game_data = self.games.get(game_id)
        if not game_data:
            return None
        
        for player_id, player_data in game_data["players"].items():
            if player_data["session_id"] == session_id:
                return (game_id, player_id)
        
        return None
    
    def make_move(self, game_id: str, session_id: str, action: str, row: int, col: int) -> dict:
        """Make a move in the game."""
        if game_id not in self.games:
            return {"error": "Game not found"}
        
        game_data = self.games[game_id]
        game = game_data["game"]
        
        # Find player
        player_id = None
        for pid, player_data in game_data["players"].items():
            if player_data["session_id"] == session_id:
                player_id = pid
                break
        
        if not player_id:
            return {"error": "Player not in game"}
        
        # Check if it's player's turn
        if game_data["current_player"] != player_id:
            return {"error": "Not your turn"}
        
        # Track turn start time for time tracking
        current_time = time.time()
        if player_id not in game_data["player_turn_start"]:
            game_data["player_turn_start"][player_id] = current_time
        
        # Execute action
        if action == "reveal":
            result = game.reveal_cell(row, col, player_id)
        elif action == "flag":
            result = game.toggle_flag(row, col)
            # Track flagged mines (only if it's actually a mine)
            if "error" not in result and (row, col) in game.mine_positions:
                if result.get("result") == "flagged":
                    game_data["player_stats"][player_id]["mines_flagged"] += 1
                elif result.get("result") == "unflagged":
                    game_data["player_stats"][player_id]["mines_flagged"] = max(0, game_data["player_stats"][player_id]["mines_flagged"] - 1)
        else:
            return {"error": "Invalid action"}
        
        if "error" in result:
            return result
        
        # Update player statistics
        if action == "reveal":
            if result.get("mine_hit"):
                # Player hit a mine
                game_data["player_stats"][player_id]["mines_hit"] += 1
            else:
                # Player revealed safe cells (including flood-filled cells)
                cells_revealed = result.get("cells_revealed", 1)
                game_data["player_stats"][player_id]["cells_revealed"] += cells_revealed
        
        # Update time played for current player
        if player_id in game_data["player_turn_start"]:
            turn_duration = current_time - game_data["player_turn_start"][player_id]
            game_data["player_stats"][player_id]["time_played"] += turn_duration
        
        # Switch turn logic
        if action == "reveal":
            game_mode = game_data.get("game_mode", "classic")
            
            if game_mode == "survival":
                # In survival mode, only switch turn when mine is hit
                if result.get("switch_turn", False):
                    # Update time for previous player before switching
                    game_data["player_turn_start"][player_id] = current_time
                    new_player = "player2" if player_id == "player1" else "player1"
                    game_data["current_player"] = new_player
                    game_data["player_turn_start"][new_player] = current_time
                else:
                    # Reset turn start time for same player
                    game_data["player_turn_start"][player_id] = current_time
            else:
                # Classic mode: switch turn after each move (unless game over)
                if not result.get("game_over", False):
                    game_data["player_turn_start"][player_id] = current_time
                    new_player = "player2" if player_id == "player1" else "player1"
                    game_data["current_player"] = new_player
                    game_data["player_turn_start"][new_player] = current_time
        
        game_data["last_activity"] = time.time()
        
        return {
            "result": result,
            "current_player": game_data["current_player"],
            "game_state": game.get_serialized_state(),
            "player_stats": game_data["player_stats"]
        }
    
    def get_game_state(self, game_id: str) -> Optional[dict]:
        """Get current game state."""
        if game_id not in self.games:
            return None
        
        game_data = self.games[game_id]
        return {
            "game_state": game_data["game"].get_serialized_state(),
            "current_player": game_data["current_player"],
            "players": {pid: p["name"] for pid, p in game_data["players"].items()},
            "status": game_data["game"].status.value,
            "game_mode": game_data.get("game_mode", "classic"),
            "player_stats": game_data.get("player_stats", {
                "player1": {"mines_hit": 0, "cells_revealed": 0, "time_played": 0, "mines_flagged": 0},
                "player2": {"mines_hit": 0, "cells_revealed": 0, "time_played": 0, "mines_flagged": 0}
            })
        }
    
    def disconnect_player(self, session_id: str):
        """Handle player disconnection."""
        result = self.get_player_game(session_id)
        if not result:
            return
        
        game_id, player_id = result
        if game_id not in self.games:
            return
        
        game_data = self.games[game_id]
        if player_id in game_data["players"]:
            del game_data["players"][player_id]
        
        if session_id in self.player_sessions:
            del self.player_sessions[session_id]
        
        # If no players left, mark for cleanup
        if len(game_data["players"]) == 0:
            game_data["last_activity"] = 0  # Mark for immediate cleanup
    
    def cleanup_inactive_games(self):
        """Remove games that have been inactive for too long."""
        current_time = time.time()
        games_to_remove = []
        
        for game_id, game_data in self.games.items():
            if current_time - game_data["last_activity"] > self.game_timeout:
                games_to_remove.append(game_id)
        
        for game_id in games_to_remove:
            # Remove player sessions
            game_data = self.games[game_id]
            for player_data in game_data["players"].values():
                session_id = player_data["session_id"]
                if session_id in self.player_sessions:
                    del self.player_sessions[session_id]
            del self.games[game_id]


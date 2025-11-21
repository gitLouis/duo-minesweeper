import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import json
import uuid
from game_manager import GameManager

load_dotenv()

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize game manager
game_manager = GameManager()

# Serve static files (frontend)
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_path):
    # Serve CSS and JS files
    @app.get("/styles.css")
    async def get_styles():
        css_path = os.path.join(frontend_path, "styles.css")
        if os.path.exists(css_path):
            return FileResponse(css_path, media_type="text/css")
        raise HTTPException(status_code=404)
    
    @app.get("/minesweeper.js")
    async def get_minesweeper_js():
        js_path = os.path.join(frontend_path, "minesweeper.js")
        if os.path.exists(js_path):
            return FileResponse(js_path, media_type="application/javascript")
        raise HTTPException(status_code=404)
    
    @app.get("/game.js")
    async def get_game_js():
        js_path = os.path.join(frontend_path, "game.js")
        if os.path.exists(js_path):
            return FileResponse(js_path, media_type="application/javascript")
        raise HTTPException(status_code=404)


@app.get("/favicon.ico")
async def favicon():
    """Handle favicon request."""
    from fastapi.responses import Response
    return Response(status_code=204)  # No Content

@app.get("/")
async def read_root():
    """Serve the main HTML file."""
    html_path = os.path.join(frontend_path, "index.html")
    if os.path.exists(html_path):
        return FileResponse(html_path)
    return {"message": "Minesweeper API"}


# REST API endpoints
@app.post("/api/create-game")
async def create_game(difficulty: str = "medium", game_mode: str = "classic", rows: int = None, cols: int = None, mines: int = None):
    """Create a new game."""
    result = game_manager.create_game(difficulty, game_mode, rows, cols, mines)
    return result


@app.get("/api/game/{game_id}")
async def get_game(game_id: str):
    """Get game state."""
    game_data = game_manager.get_game(game_id)
    if not game_data:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return {
        "game_id": game_id,
        "players": {pid: p["name"] for pid, p in game_data["players"].items()},
        "status": game_data["game"].status.value,
        "current_player": game_data["current_player"]
    }


@app.get("/api/game/{game_id}/status")
async def get_game_status(game_id: str):
    """Check if game exists and get basic status."""
    game_data = game_manager.get_game(game_id)
    if not game_data:
        return {"exists": False}
    
    return {
        "exists": True,
        "players_count": len(game_data["players"]),
        "status": game_data["game"].status.value
    }


# Store active WebSocket connections
active_connections: dict = {}  # {session_id: websocket}


async def broadcast_to_game(game_id: str, message: dict):
    """Broadcast message to all players in a game."""
    game_data = game_manager.get_game(game_id)
    if not game_data:
        return
    
    disconnected_sessions = []
    for player_id, player_data in game_data["players"].items():
        session_id = player_data["session_id"]
        if session_id in active_connections:
            try:
                await active_connections[session_id].send_json(message)
            except:
                disconnected_sessions.append(session_id)
        else:
            disconnected_sessions.append(session_id)
    
    # Clean up disconnected sessions
    for session_id in disconnected_sessions:
        game_manager.disconnect_player(session_id)
        if session_id in active_connections:
            del active_connections[session_id]


async def notify_other_players(game_id: str, exclude_session: str, message: dict):
    """Notify all players except the excluded session."""
    game_data = game_manager.get_game(game_id)
    if not game_data:
        return
    
    for player_id, player_data in game_data["players"].items():
        session_id = player_data["session_id"]
        if session_id != exclude_session and session_id in active_connections:
            try:
                await active_connections[session_id].send_json(message)
            except:
                pass


# Store WebSocket connections
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = str(uuid.uuid4())
    active_connections[session_id] = websocket
    game_id = None
    player_id = None
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            if msg_type == "join":
                game_id = message.get("gameId")
                player_name = message.get("playerName")
                
                if not game_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Game ID required"
                    })
                    continue
                
                result = game_manager.join_game(game_id, session_id, player_name)
                
                if "error" in result:
                    await websocket.send_json({
                        "type": "error",
                        "message": result["error"]
                    })
                    continue
                
                player_id = result["player_id"]
                game_data = game_manager.get_game(game_id)
                
                game_state = game_manager.get_game_state(game_id)
                await websocket.send_json({
                    "type": "joined",
                    "player_id": player_id,
                    "game_id": game_id,
                    "players": result["players"],
                    "game_state": game_state
                })
                
                game_state = game_manager.get_game_state(game_id)
                await notify_other_players(game_id, session_id, {
                    "type": "player_joined",
                    "player_id": player_id,
                    "player_name": result["players"][player_id],
                    "players": result["players"],
                    "game_state": game_state
                })
            
            elif msg_type == "reveal" or msg_type == "flag":
                if not game_id or not player_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Not in a game"
                    })
                    continue
                
                row = message.get("row")
                col = message.get("col")
                
                if row is None or col is None:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Row and col required"
                    })
                    continue
                
                result = game_manager.make_move(game_id, session_id, msg_type, row, col)
                
                if "error" in result:
                    await websocket.send_json({
                        "type": "error",
                        "message": result["error"]
                    })
                    continue
                
                # Get full game state with proper structure
                full_game_state = game_manager.get_game_state(game_id)
                
                broadcast_message = {
                    "type": "action_result",
                    "action": msg_type,
                    "row": row,
                    "col": col,
                    "result": result["result"],
                    "current_player": result["current_player"],
                    "player_id": player_id,  # Include which player made the move
                    "game_state": full_game_state,
                    "player_stats": result.get("player_stats", {})
                }
                
                await broadcast_to_game(game_id, broadcast_message)
                
                # Only send game_over if it's actually game over (not just a mine hit in survival mode)
                if result["result"].get("game_over"):
                    game_over_msg = {
                        "type": "game_over",
                        "won": result["result"].get("won", False),
                        "reason": result["result"].get("result", "unknown")
                    }
                    await broadcast_to_game(game_id, game_over_msg)
            
            elif msg_type == "get_state":
                if not game_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Not in a game"
                    })
                    continue
                
                game_state = game_manager.get_game_state(game_id)
                await websocket.send_json({
                    "type": "game_state",
                    "game_state": game_state
                })
            
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}"
                })
    
    except WebSocketDisconnect:
        if game_id:
            game_manager.disconnect_player(session_id)
            await notify_other_players(game_id, session_id, {
                "type": "player_disconnected",
                "player_id": player_id
            })
        if session_id in active_connections:
            del active_connections[session_id]
    except Exception as e:
        print(f"WebSocket error: {e}")
        if game_id:
            game_manager.disconnect_player(session_id)
        if session_id in active_connections:
            del active_connections[session_id]


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)


# Two-Player Minesweeper

An online multiplayer Minesweeper game where two players take turns on a shared board. Built with FastAPI (Python) backend and vanilla HTML/CSS/JavaScript frontend.

## Features

- **Two-player turn-based gameplay** on a shared Minesweeper board
- **Real-time synchronization** via WebSockets
- **Shareable game links** for easy player connection
- **Multiple difficulty levels** (Easy, Medium, Hard)
- **Calculation history** and game state persistence
- **Responsive design** for desktop and mobile devices

## Project Structure

```
.
├── backend/
│   ├── app.py                 # FastAPI application with WebSocket support
│   ├── game_logic.py          # Minesweeper game engine
│   ├── game_manager.py        # Multiplayer game state management
│   ├── requirements.txt       # Python dependencies
│   └── .env.example           # Environment variables template
├── frontend/
│   ├── index.html             # Main game page
│   ├── styles.css             # Game styling
│   ├── game.js                # WebSocket client and game coordination
│   └── minesweeper.js         # Client-side board rendering
├── .gitignore
├── Procfile                   # Cloud deployment configuration
└── README.md                  # This file
```

## Setup

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd /Users/sl/dev/cursor_experiment
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install backend dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. **Set up environment variables (optional):**
   ```bash
   cp .env.example .env
   # Edit .env if needed (defaults work for local development)
   ```

## Running Locally

### Start the Backend Server

From the `backend` directory:

```bash
python app.py
```

Or using uvicorn directly:

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

The server will start on `http://localhost:8000`

### Access the Frontend

Open your browser and navigate to:
```
http://localhost:8000
```

The frontend is served by the FastAPI backend.

## How to Play

1. **Create a Game:**
   - Select a difficulty level (Easy, Medium, or Hard)
   - Click "Create New Game"
   - Copy the shareable link

2. **Join a Game:**
   - Enter the game ID or paste the shareable link
   - Click "Join Game"

3. **Gameplay:**
   - Players take turns revealing cells
   - Left-click to reveal a cell
   - Right-click to flag/unflag a cell
   - The game ends when a mine is hit (loss) or all non-mine cells are revealed (win)

## Docker Deployment

### Using Docker

1. **Build the Docker image:**
   ```bash
   docker build -t minesweeper-game .
   ```

2. **Run the container:**
   ```bash
   docker run -p 8000:8000 minesweeper-game
   ```

3. **Using Docker Compose:**
   ```bash
   docker-compose up
   ```

   Or run in detached mode:
   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   Open your browser and navigate to `http://localhost:8000`

### Docker Environment Variables

You can customize the port and host by setting environment variables:
```bash
docker run -p 8000:8000 -e PORT=8000 -e HOST=0.0.0.0 minesweeper-game
```

## Deployment

### Heroku

1. **Install Heroku CLI** and login:
   ```bash
   heroku login
   ```

2. **Create a Heroku app:**
   ```bash
   heroku create your-app-name
   ```

3. **Set buildpacks:**
   ```bash
   heroku buildpacks:set heroku/python
   ```

4. **Deploy:**
   ```bash
   git push heroku main
   ```

5. **Set environment variables (if needed):**
   ```bash
   heroku config:set PORT=8000
   ```

### Railway

1. **Connect your repository** to Railway
2. **Set the root directory** to the project root
3. **Set start command:** `cd backend && uvicorn app:app --host 0.0.0.0 --port $PORT`
4. **Deploy**

### Render

1. **Create a new Web Service** on Render
2. **Set build command:** `cd backend && pip install -r requirements.txt`
3. **Set start command:** `cd backend && uvicorn app:app --host 0.0.0.0 --port $PORT`
4. **Set environment variables:**
   - `PORT`: 8000 (or let Render assign)
5. **Deploy**

## API Endpoints

### REST API

- `POST /api/create-game?difficulty={easy|medium|hard}` - Create a new game
- `GET /api/game/{game_id}` - Get game information
- `GET /api/game/{game_id}/status` - Check game status

### WebSocket

- `WS /ws` - WebSocket connection for real-time game updates

**WebSocket Messages (Client → Server):**
- `{ type: "join", gameId: "...", playerName: "..." }` - Join a game
- `{ type: "reveal", gameId: "...", row: 5, col: 3 }` - Reveal a cell
- `{ type: "flag", gameId: "...", row: 5, col: 3 }` - Toggle flag on a cell
- `{ type: "get_state", gameId: "..." }` - Request current game state

**WebSocket Messages (Server → Client):**
- `{ type: "joined", player_id: "...", game_state: {...} }` - Successfully joined
- `{ type: "action_result", action: "...", result: {...}, game_state: {...} }` - Move result
- `{ type: "game_over", won: true/false }` - Game ended
- `{ type: "error", message: "..." }` - Error occurred

## Development

### Backend Structure

- **`app.py`**: Main FastAPI application with WebSocket handling
- **`game_logic.py`**: Core Minesweeper game engine with board generation and reveal logic
- **`game_manager.py`**: Manages multiple game sessions, player connections, and turn management

### Frontend Structure

- **`index.html`**: Game UI structure
- **`styles.css`**: Responsive styling with modern design
- **`game.js`**: WebSocket client, game state management, and UI updates
- **`minesweeper.js`**: Board rendering and cell interaction handling

## Troubleshooting

### WebSocket Connection Issues

- Ensure the backend server is running
- Check that WebSocket support is enabled on your hosting platform
- Verify CORS settings if accessing from a different domain

### Game Not Starting

- Check browser console for errors
- Verify WebSocket connection status (shown in UI)
- Ensure both players have successfully joined

## License

This project is open source and available for educational purposes.


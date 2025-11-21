# Docker Setup Guide

## Installing Docker on macOS

### Option 1: Install Docker Desktop (Recommended)

1. **Download Docker Desktop:**
   - Visit: https://www.docker.com/products/docker-desktop/
   - Or use Homebrew: `brew install --cask docker`

2. **Install Docker Desktop:**
   - Open the downloaded `.dmg` file
   - Drag Docker to your Applications folder
   - Open Docker from Applications
   - Follow the setup wizard

3. **Start Docker Desktop:**
   - Open Docker Desktop from Applications
   - Wait for it to start (you'll see a whale icon in the menu bar)
   - Make sure it says "Docker Desktop is running"

4. **Verify Installation:**
   ```bash
   docker --version
   docker-compose --version
   ```

### Option 2: Using Homebrew

```bash
# Install Docker Desktop via Homebrew
brew install --cask docker

# Start Docker Desktop
open /Applications/Docker.app
```

## After Installation

1. **Start Docker Desktop** (if not already running)
   - Open from Applications or Spotlight
   - Wait for the Docker icon to appear in the menu bar

2. **Verify Docker is running:**
   ```bash
   docker ps
   ```
   This should show an empty list (no error), confirming Docker is running.

3. **Build and run the Minesweeper game:**
   ```bash
   # Build the image
   docker build -t minesweeper-game .
   
   # Run the container
   docker run -p 8000:8000 minesweeper-game
   ```

   Or using Docker Compose:
   ```bash
   docker-compose up
   ```

## Troubleshooting

### Docker command still not found after installation

1. **Restart your terminal** after installing Docker Desktop

2. **Check if Docker Desktop is running:**
   - Look for the Docker whale icon in your menu bar
   - If it's not there, open Docker Desktop from Applications

3. **Add Docker to PATH (if needed):**
   ```bash
   # Add to ~/.zshrc
   echo 'export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

4. **Verify Docker Desktop settings:**
   - Open Docker Desktop
   - Go to Settings > Advanced
   - Make sure "Install Docker Desktop for: System" is selected

## Alternative: Run Without Docker

If you prefer not to use Docker, you can run the application directly:

```bash
# Install Python dependencies
cd backend
pip install -r requirements.txt

# Run the server
python app.py
```

Then open `http://localhost:8000` in your browser.


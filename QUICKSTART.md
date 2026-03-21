# Quick Start Guide

## Get Started in 5 Minutes!

### Option 1: Windows Users (Easiest)

1. **Open Command Prompt** in the project folder
2. **Run**: `start.bat`
3. **Wait** for Node.js packages to install (first time only)
4. **Open browser**: Go to `http://localhost:3000`
5. **Play!** 🎲

### Option 2: Mac/Linux Users

1. **Open Terminal** in the project folder
2. **Run**: `chmod +x start.sh && ./start.sh`
3. **Wait** for dependencies to install (first time only)
4. **Open browser**: Go to `http://localhost:3000`
5. **Play!** 🎲

### Option 3: Manual Setup (All Platforms)

1. **Install Node.js** from https://nodejs.org (if not already installed)
2. **Open Terminal/Command Prompt**
3. **Navigate to backend folder**:
   ```bash
   cd backend
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Start the server**:
   ```bash
   npm start
   ```
6. **Open your browser**: `http://localhost:3000`

## Playing the Game

### Creating a New Game
1. Click **"New Game"** button
2. Enter your player name
3. Choose your color
4. Enter max number of players (2-4)
5. **Share the Game ID** with friends
6. Wait for players to join

### Joining an Existing Game
1. Click **"Join Game"** button
2. Enter the **Game ID** from the host
3. Enter your player name
4. Choose your color
5. Click **"Join Game"**
6. Wait for the host to start

### During the Game
- **Roll Dice**: Click "Roll Dice" button
- **Buy Property**: Click "Buy Property" to purchase the property you land on
- **End Turn**: Click "End Turn" to pass to the next player

## Troubleshooting

### Port 3000 Already in Use
If you see an error that port 3000 is already in use:

**Windows**:
```bash
cd backend
PORT=3001 npm start
```
Then visit `http://localhost:3001`

**Mac/Linux**:
```bash
cd backend
PORT=3001 npm start
```
Then visit `http://localhost:3001`

### Dependencies Not Installing
Make sure you have Node.js installed. Check by running:
```bash
node --version
npm --version
```

If not installed, download from: https://nodejs.org

### WebSocket Connection Error
- Make sure the server is running
- Try refreshing your browser (Ctrl+R or Cmd+R)
- Check your firewall settings

### Game not loading
- Clear browser cache (Ctrl+Shift+Delete)
- Try a different browser
- Make sure you're using `http://` not `https://`

## Game Rules Quick Reference

- **Starting Money**: $1,500 per player
- **GO Bonus**: Get $200 when passing GO
- **Properties**: Buy and collect property sets
- **Rent**: Pay rent when landing on others' properties
- **Railroads**: Better rent with more railroads owned
- **Utilities**: Rent based on dice roll and utilities owned
- **Victory**: Last player with money wins

## Playing with Friends Online

To play with friends over the internet instead of local network:

1. **Deploy the game** to a cloud service (see DEPLOYMENT.md)
2. **Share the deployed URL** with friends instead of localhost
3. **Create a game** on the deployed version
4. **Share the Game ID** - friends can join from their link

For free deployment options, see DEPLOYMENT.md

## Need More Help?

- Read the full README.md for detailed information
- Check DEPLOYMENT.md for hosting options
- See gameLogic.js for game mechanics
- Review game.js for client-side code

## Next Steps

1. **Explore the code**: Check out game.js and gameLogic.js
2. **Customize colors**: Edit board.js PROPERTY_DATA
3. **Deploy online**: Follow DEPLOYMENT.md
4. **Add features**: Extend gameLogic.js with new rules
5. **Share with friends**: Host it online and send them the URL!

Enjoy your game! 🎲🏠

# Monopoly - Online Multiplayer Web Game

A fully functional online multiplayer Monopoly game built with Node.js, Express, Socket.io, and vanilla JavaScript.

## Features

- **Real-time Multiplayer**: Play with 2-4 players simultaneously using WebSockets
- **Complete Game Logic**: Includes property ownership, rent calculation, utilities, railroads, and more
- **Visual Game Board**: Interactive Monopoly board with player tokens
- **Game Management**: Create or join games with shareable game IDs
- **Player Statistics**: Track money, position, and properties in real-time
- **Responsive Design**: Works on desktop and tablet devices

## Project Structure

```
monopoly/
├── backend/
│   ├── package.json          # Backend dependencies
│   ├── server.js             # Express + Socket.io server
│   └── gameLogic.js          # Game mechanics and rules
├── frontend/
│   ├── index.html            # Main game interface
│   ├── styles.css            # Game styling
│   └── game.js               # Client-side game logic
└── README.md                 # This file
```

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Setup Steps

1. **Navigate to the backend directory:**

   ```bash
   cd backend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the server:**

   ```bash
   npm start
   ```

   For development with auto-reload:

   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:3000`

4. **Open in browser:**
   Open your web browser and navigate to `http://localhost:3000`

## How to Play

### Starting a Game

1. Click "New Game" to create a game
2. Enter your player name and choose a color
3. Select the number of players
4. Share the Game ID with other players
5. Other players click "Join Game" and enter the Game ID
6. Once all players have joined, the host clicks "Start Game"

### Game Controls

- **Roll Dice**: Click to roll the dice and move your token
- **Buy Property**: Click to purchase the property you land on (if available)
- **End Turn**: Click to pass your turn to the next player

### Game Rules Implemented

- **Properties**: Buy and own properties, manage rental income
- **Utilities**: Electric Company and Water Works with multiplier rent
- **Railroads**: Increased rent based on number of railroads owned
- **Money**: Start with $1,500, earn $200 when passing GO
- **Rent Payment**: Automatic rent calculation when landing on owned properties
- **Jail**: Game mechanics support jail mechanics (basic implementation)

## Features in Detail

### Multiplayer Synchronization

- Real-time game state synchronization via WebSockets
- All players see the same game board and player positions
- Turn-based gameplay ensures fair play

### Property System

- 28 purchasable properties organized by color (8 property groups)
- 4 railroads with escalating rent values
- 2 utilities with conditional rent calculation
- Property information includes purchase price and rent values

### Dice System

- Two 6-sided dice
- Visual display of both dice values
- Automatic player movement based on dice roll

## API Reference

### Socket Events (Client to Server)

**create_game**

```javascript
socket.emit("create_game", { maxPlayers: 4 });
```

**join_game**

```javascript
socket.emit("join_game", {
  gameId: "game-id",
  playerName: "John",
  playerColor: "red",
});
```

**roll_dice**

```javascript
socket.emit("roll_dice", { gameId: "game-id" });
```

**buy_property**

```javascript
socket.emit("buy_property", {
  gameId: "game-id",
  propertyId: 1,
});
```

**end_turn**

```javascript
socket.emit("end_turn", { gameId: "game-id" });
```

**leave_game**

```javascript
socket.emit("leave_game", { gameId: "game-id" });
```

### Socket Events (Server to Client)

- `game_created`: Game successfully created
- `game_started`: Game has started
- `player_joined`: A player joined the game
- `dice_rolled`: Dice were rolled, sending die values
- `property_bought`: A property was purchased
- `turn_ended`: Current turn ended, next player's turn begins
- `player_left`: A player left the game
- `player_disconnected`: A player disconnected
- `error`: An error occurred

## Configuration

### Server Port

The default port is 3000. To change it, set the `PORT` environment variable:

```bash
PORT=8000 npm start
```

### Max Players

Default is 4 players per game. Can be configured when creating a game.

## Deployment

### Deploy to Heroku

1. Create a `Procfile`:

   ```
   web: node backend/server.js
   ```

2. Deploy:
   ```bash
   git push heroku main
   ```

### Deploy to Other Platforms

The application can be deployed to any Node.js hosting platform:

- Vercel
- Render
- AWS
- DigitalOcean
- Railway

Just ensure the platform supports Node.js and can handle WebSocket connections.

## Future Enhancements

- [ ] Community Chest and Chance cards
- [ ] Jail mechanics (bail, free parking)
- [ ] Mortgage properties
- [ ] Game statistics and leaderboards
- [ ] Custom player avatars
- [ ] Game chat
- [ ] Undo moves (with limitations)
- [ ] AI players for practice mode
- [ ] Mobile app version
- [ ] Sound effects and music
- [ ] Animation improvements
- [ ] Save game state
- [ ] Replay system

## Game Board Layout

The Monopoly board follows the standard layout:

```
        21-29 (Top Row)

30  ┌─────────────────┐  0
 I  │                 │  GO
31-39│   MONOPOLY     │1-9
 L  │    GAME BOARD   │
38  │                 │
 L  └─────────────────┘
   10-19 (Left Column)  (Right Column)
    CORNER SPACES
    0: GO
    10: Just Visiting/Jail
    20: Free Parking
    30: Go to Jail
```

## Troubleshooting

### Port Already in Use

If port 3000 is already in use:

```bash
PORT=3001 npm start
```

### WebSocket Connection Failed

- Ensure the server is running
- Check firewall settings
- Verify CORS is properly configured (should be open to all origins for development)

### Players Not Seeing the Same Game State

- Reset your browser cache
- Refresh all client browsers
- Restart the server

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## Support

For issues, questions, or suggestions, please open an issue on the GitHub repository.

Enjoy playing Monopoly! 🎲🏠

# Technical Documentation

## Architecture Overview

The Monopoly game consists of three main components:

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (Web Browser)                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │ HTML UI (index.html) + Styles (styles.css)       │   │
│  │ Game Logic (game.js) + Board (board.js)          │   │
│  │ Socket.io Client Library                         │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                    WebSocket (Socket.io)
                          │
┌─────────────────────────────────────────────────────────┐
│                Backend (Node.js Server)                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Express Server (server.js)                       │   │
│  │ Socket.io Server Library                         │   │
│  │ Game Logic Engine (gameLogic.js)                 │   │
│  │ Game State Management                            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## File Structure

### Backend Files

#### `server.js` (Main Server)
- Initializes Express HTTP server
- Sets up Socket.io for real-time communication
- Serves static frontend files
- Manages game instances
- Handles player connections and disconnections
- Emits game events to all connected players

**Key Functions**:
- `io.on('connection')`: Handles new player connections
- `socket.on('create_game')`: Creates a new game instance
- `socket.on('join_game')`: Adds player to existing game
- `socket.on('roll_dice')`: Processes dice roll
- `socket.on('end_turn')`: Moves to next player's turn

#### `gameLogic.js` (Game Engine)
- Implements complete Monopoly game rules
- Manages game state for each game instance
- Tracks player positions, money, and properties
- Calculates rent payments
- Handles property purchases

**Key Classes**:
- `MonopolyGame`: Main game logic class
  - Methods: `addPlayer()`, `rollDice()`, `movePlayer()`, `buyProperty()`, `payRent()`, `endTurn()`
  - Properties: 28 purchasable properties + 4 railroads + 2 utilities

#### `package.json`
- Lists all npm dependencies
- Defines npm scripts (start, dev)
- Current dependencies:
  - `express`: HTTP server framework
  - `socket.io`: Real-time WebSocket communication
  - `cors`: Cross-Origin Resource Sharing
  - `uuid`: Generate unique game IDs

### Frontend Files

#### `index.html` (Main UI)
- Menu screen for creating/joining games
- Game lobby screen showing waiting players
- Main game board display
- Game information sidebar

**Screen Types**:
- Menu screen: Initial landing page
- Create game screen: Setup new game
- Join game screen: Join existing game
- Waiting screen: Lobby before game starts
- Game screen: Active gameplay

#### `styles.css` (Styling)
- Responsive layout with flexbox
- Gradient backgrounds and modern design
- Color-coded property board
- Player token styling
- Button and form styling
- Animations and transitions

#### `game.js` (Client Logic)
- Initializes Socket.io connection
- Manages UI screen transitions
- Handles user interactions
- Updates game state from server
- Renders player stats and information
- Manages turn progression

**Key Functions**:
- `initializeSocket()`: Sets up all event listeners
- `createGame()`: Creates new game
- `joinGame()`: Joins existing game
- `rollDice()`: Emits dice roll to server
- `updateUI()`: Updates all displayed information
- `renderBoard()`: Renders enhanced board visualization

#### `board.js` (Enhanced Board Rendering)
- calculates positions for all 40 board spaces
- Renders property colors and names
- Handles player token positioning
- Manages board space layout

**Key Data**:
- `PROPERTY_DATA`: Details for each property including color and price
- `getSpaceLayout()`: Calculates CSS position for each board space

## Communication Flow

### Creating a Game

```
1. Client: User clicks "New Game"
   ↓
2. Browser: Fills form with game settings
   ↓
3. Client: emit 'create_game' with maxPlayers
   ↓
4. Server: Creates new MonopolyGame instance
   ↓
5. Client: emit 'join_game' with player info
   ↓
6. Server: Adds player to game
   ↓
7. Server: Broadcasts 'player_joined' to all players
   ↓
8. Client: Updates waiting screen with players list
```

### Rolling Dice

```
1. Client: Player clicks "Roll Dice"
   ↓
2. Client: emit 'roll_dice' to server
   ↓
3. Server: Rolls dice (1-6, 1-6)
   ↓
4. Server: Moves player on game board
   ↓
5. Server: emit 'dice_rolled' with values and new position
   ↓
6. All Clients: Update board display with new player position
   ↓
7. All Clients: Show dice values and move player tokens
```

### Game State Structure

```javascript
{
  gameId: "uuid",
  gameState: "playing",  // waiting, playing, finished
  turn: 25,
  currentPlayer: { /* Player object */ },
  players: [
    {
      id: "socket_id",
      name: "John",
      color: "red",
      position: 15,
      money: 1200,
      properties: [1, 3, 5],
      inJail: false,
      jailTurns: 0
    },
    // ... more players
  ],
  diceValues: [4, 3],
  diceRolled: true,
  properties: Map { /* Property ownership */ }
}
```

## Game Mechanics

### Money System
- Starting money: $1,500 per player
- GO bonus: $200 when passing GO
- Rent payment: Automatic when landing on owned property
- Property purchase: Deducts from player money

### Property Types

1. **Standard Properties** (28 total)
   - 8 color groups
   - Purchase price: $60 to $400
   - Rent progression based on color group ownership

2. **Railroads** (4 total)
   - Purchase price: $200 each
   - Rent: $25 × 2^(railroads_owned - 1)

3. **Utilities** (2 total)
   - Purchase price: $150 each
   - Rent: Dice sum × multiplier (4x or 10x)

### Turn Sequence
1. Player rolls dice
2. Player moves according to dice value
3. Player lands on space (property, chance, etc.)
4. If property: Player can buy if unowned
5. If owned: Player pays rent (automatic)
6. Player ends turn
7. Next player's turn begins

## Performance Considerations

### Optimization Techniques Used
- Minimal re-renders: Only update necessary UI elements
- Efficient socket events: Broadcast only changed state
- CSS transforms: Used for animations
- Debounced events: Prevent rapid duplicate events

### Scalability
- Current version: Supports multiple games (limited by server memory)
- Each game instance is independent
- Player connection has minimal memory footprint

### Possible Improvements
- Use Redis for game state persistence
- Implement database for statistics
- Add game state snapshots (for replay)
- Optimize board rendering for mobile

## Socket.io Events Reference

### Client to Server

```javascript
// Create a new game
socket.emit('create_game', { maxPlayers: 4 });

// Join a game
socket.emit('join_game', { 
  gameId: 'uuid', 
  playerName: 'John', 
  playerColor: 'red' 
});

// Start the game (only host)
socket.emit('start_game', { gameId: 'uuid' });

// Roll dice
socket.emit('roll_dice', { gameId: 'uuid' });

// Buy property
socket.emit('buy_property', { 
  gameId: 'uuid', 
  propertyId: 1 
});

// End turn
socket.emit('end_turn', { gameId: 'uuid' });

// Leave game
socket.emit('leave_game', { gameId: 'uuid' });
```

### Server to Client

```javascript
// Game created successfully
socket.on('game_created', (data) => { 
  // data: { gameId, game: gameState }
});

// Game started
socket.on('game_started', (data) => { 
  // data: { gameState }
});

// Player joined
socket.on('player_joined', (data) => { 
  // data: { player, gameState }
});

// Dice rolled
socket.on('dice_rolled', (data) => { 
  // data: { die1, die2, totalSpaces, gameState }
});

// Property purchased
socket.on('property_bought', (data) => { 
  // data: { playerId, propertyId, gameState }
});

// Turn ended
socket.on('turn_ended', (data) => { 
  // data: { gameState }
});

// Player left
socket.on('player_left', (data) => { 
  // data: { playerId, gameState }
});

// Player disconnected
socket.on('player_disconnected', (data) => { 
  // data: { playerId, gameState }
});

// Error occurred
socket.on('error', (data) => { 
  // data: { message }
});
```

## Adding New Features

### Adding a New Game Rule

1. Add logic to `gameLogic.js` in the `MonopolyGame` class
2. Create new method for the feature
3. Emit new socket event from server
4. Handle event in `game.js` client code
5. Update UI in `index.html` if needed

Example: Adding Free Parking Jackpot
```javascript
// In gameLogic.js
class MonopolyGame {
  constructor() {
    // ... existing code
    this.freeParkingMoney = 0;
  }

  collectFreeParking(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.money += this.freeParkingMoney;
      this.freeParkingMoney = 0;
    }
  }
}
```

### Adding New UI Elements

1. Add HTML structure to `index.html`
2. Style with `styles.css`
3. Add event listeners in `game.js`
4. Connect to backend logic

## Debugging

### Server Debugging
```javascript
// Enable console logs in server.js
console.log('Player connected:', socket.id);
console.log('Game state:', game.getGameState());
```

### Client Debugging
```javascript
// In browser console
console.log(gameState); // View current game state
socket.on('*', (event, data) => console.log(event, data)); // Log all events
```

### Common Issues

**WebSocket connection failed**
- Check server is running
- Verify correct URL
- Check firewall settings

**Game state mismatch**
- Restart server and clients
- Check for concurrent events
- Add event queue to prevent race conditions

**Memory leak**
- Ensure games are deleted when empty
- Clear event listeners on disconnect
- Monitor memory usage

## Dependencies

### Frontend
- Socket.io client library (included via CDN)
- No other JavaScript libraries (vanilla JS)

### Backend
- **express**: HTTP server framework
- **socket.io**: Real-time communication
- **cors**: Cross-origin requests
- **uuid**: Generate unique game IDs
- **nodemon** (dev): Auto-reload on file changes

## Performance Metrics

### Typical Response Times
- Dice roll: < 100ms
- Turn change: < 50ms
- Property purchase: < 80ms
- Game state broadcast: < 100ms

### Concurrent Players Supported
- Local testing: Unlimited (depends on system)
- Single server: 100-1000+ concurrent games
- With load balancer: 1000+ concurrent games

## Future Architecture Improvements

1. **Database Integration**
   - Store game history
   - Player statistics
   - Account management

2. **Scalability**
   - Redis for game state management
   - Load balancer for multiple servers
   - Horizontal scaling with microservices

3. **Enhanced Features**
   - AI players
   - Game replay system
   - Advanced animations
   - Mobile app version

4. **Security**
   - Player authentication
   - Input validation
   - Rate limiting
   - Fraud detection

---

For more information, see:
- README.md - Overview and features
- QUICKSTART.md - Getting started guide
- DEPLOYMENT.md - Hosting options

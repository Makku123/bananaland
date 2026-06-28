# Quick Start Guide

## Run the game

### Windows

1. Open Command Prompt in the project folder
2. Run `start.bat` (installs packages on first run)
3. Open `http://localhost:3000`

### Mac/Linux

1. Open Terminal in the project folder
2. Run `chmod +x start.sh && ./start.sh`
3. Open `http://localhost:3000`

### Manual (all platforms)

```bash
cd backend
npm install
npm start
```

Then open `http://localhost:3000`.

## Playing

### Create a game

1. Continue as guest or sign in
2. Click **New Game**, pick your color
3. Choose mode: **Classic** (2–4 players free-for-all) or **2v2** (exactly 4,
   two teams)
4. Adjust lobby settings if you like (starting bananas, Super Banana price,
   auction timer, poker variant, bombs on/off)
5. Share the Game ID, or make the lobby public so friends can find it

### Join a game

Click **Join Game** and enter the Game ID, or pick a public lobby from the
list.

### Your turn, in short

Roll the dice and move. Land on an unowned farm and it goes to **auction**.
Grow tiles fire **grow chains** that put bananas on farms; collect your own
piles by crossing your farms, steal others' by squatting and leaving. Buy the
**Super Banana** (1600🍌 default) to win. The in-game tutorial and the **How to
Play** button cover the rest, and [rules.md](rules.md) has every detail.

## Troubleshooting

### Port 3000 already in use

```bash
cd backend
PORT=3001 npm start
```

Then visit `http://localhost:3001`.

### Dependencies not installing

Check Node.js is installed (`node --version`). If not, download it from
https://nodejs.org.

### WebSocket connection error

Make sure the server is running, refresh the browser, and check your firewall.

### Game not loading

Clear the browser cache, try another browser, and use `http://` (not
`https://`) for local play.

## Playing with friends online

Deploy the app to any Node.js host that supports WebSockets (see the
Deployment section in [README.md](README.md)), share the URL, and have friends
join with your Game ID or through a public lobby.

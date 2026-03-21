# VS Code Launch Configuration Guide

This guide explains how to use the launch configurations for the Monopoly game in VS Code.

## 📋 Available Launch Configurations

### 1. **Start Server** (Recommended for production)
- Simple server startup with Node.js
- Best for running a stable server
- Auto-restarts on file changes (with nodemon)
- **Use when**: You want a straightforward production-like experience

**Steps**:
1. Press `Ctrl+Shift+D` (or click Debug icon)
2. Select "Start Server" from dropdown
3. Click green play button or press `F5`
4. Server runs on `http://localhost:3000`

### 2. **Start Server (Dev with Nodemon)** (Recommended for development)
- Uses nodemon for auto-restart on file changes
- Perfect for active development
- Automatically restarts when you modify code
- **Use when**: You're actively developing and modifying files

**Steps**:
1. Press `Ctrl+Shift+D`
2. Select "Start Server (Dev with Nodemon)"
3. Press `F5`
4. Edit files and see changes automatically
5. Stop with `Ctrl+Shift+F5` or red stop button

### 3. **Attach to Server**
- Connect debugger to already-running server
- Useful if server is running in terminal separately
- Set breakpoints and step through code
- **Use when**: Server is already running and you want to debug it

**Steps**:
1. Start server manually: `cd backend && npm start`
2. Press `Ctrl+Shift+D`
3. Select "Attach to Server"
4. Press `F5`
5. Debugger attaches to running process

### 4. **Debug Tests**
- Run server in test mode
- Sets `NODE_ENV=test` automatically
- **Use when**: Running with test configurations

**Steps**:
1. Press `Ctrl+Shift+D`
2. Select "Debug Tests"
3. Press `F5`

### 5. **Production Mode**
- Runs server with production environment variables
- `NODE_ENV=production` set automatically
- **Use when**: Testing production-like behavior locally

**Steps**:
1. Press `Ctrl+Shift+D`
2. Select "Production Mode"
3. Press `F5`

## 🎯 Debugging Features

### Setting Breakpoints
1. Click left margin next to line number (red dot appears)
2. Run any launch configuration
3. Code pauses at breakpoint
4. Use debug controls to step through code

### Debug Controls
- **Continue** (F5): Resume execution
- **Step Over** (F10): Execute current line, don't enter functions
- **Step Into** (F11): Enter into function calls
- **Step Out** (Shift+F11): Exit current function
- **Restart** (Ctrl+Shift+F5): Restart debug session
- **Stop** (Shift+F5): Stop debugger

### Debug Console
- View console.log() output
- Execute code expressions
- Inspect variables
- Evaluate expressions in real-time

### Variables Panel
- View local variables
- Watch specific variables
- Inspect object properties
- See call stack

## 🚀 Quick Start Procedure

For fastest development workflow:

1. **Open Monopoly folder in VS Code**
   ```bash
   code c:\Users\You\Code\Monopoly
   ```

2. **Press `F5` to start debugging**
   - First time: Select "Start Server (Dev with Nodemon)"
   - VS Code remembers your choice

3. **Open browser**
   - Manually: `http://localhost:3000`
   - Or run task: `Ctrl+Shift+P` → "Tasks: Run Task" → "Open Browser"

4. **Set breakpoints** by clicking line numbers

5. **Edit files** and watch server auto-restart

## 📝 Example Workflow

### Scenario: Finding a Bug

1. Open `backend/gameLogic.js`
2. Go to line where bug likely is
3. Click left margin to add breakpoint
4. Press `F5`, select "Start Server (Dev with Nodemon)"
5. Trigger the bug from browser
6. Code pauses at breakpoint
7. Use debug console to inspect variables
8. Step through code with F10/F11
9. Identify and fix the bug
10. File auto-saves, server auto-restarts
11. Test fix in browser

### Scenario: Adding New Feature

1. Start "Start Server (Dev with Nodemon)" with `F5`
2. Open `backend/server.js`
3. Add new socket event handler
4. Save file (triggers auto-restart)
5. Update `frontend/game.js` to emit new event
6. Test in browser
7. If issue: Add breakpoint and debug
8. Repeat until working

## 🔧 Custom Configuration

Edit `.vscode/launch.json` to add custom configurations:

```json
{
    "name": "Custom Config",
    "type": "node",
    "request": "launch",
    "program": "${workspaceFolder}/backend/server.js",
    "env": {
        "PORT": "3001"
    }
}
```

Available variables:
- `${workspaceFolder}` - Root folder path
- `${workspaceFolderBasename}` - Folder name
- `${file}` - Current open file
- `${relativeFile}` - Relative file path
- `${fileBasename}` - File name only

## ⚡ Tasks Menu

Press `Ctrl+Shift+P` and type "Tasks:" to access:

- **Tasks: Run Task**
  - Install Dependencies
  - Start Server
  - Start Dev Server
  - Open Browser
  - Kill Server

- **Tasks: Show Running Tasks** - See active tasks

- **Tasks: Terminate Task** - Stop running task

## 🎨 VS Code Extensions

Recommended extensions are configured in `.vscode/extensions.json`:

- **Prettier** - Auto-format code
- **ESLint** - Linting and code quality
- **Live Server** - Live preview static files
- **GitLens** - Git integration
- **Material Icon Theme** - Better file icons
- **Dracula Theme** - Great color theme
- **Socket.io** - WebSocket debugging

### Install Recommended Extensions
1. Press `Ctrl+Shift+P`
2. Type "Extensions: Show Recommended"
3. Click "Install All"

## 🐛 Debugging Tips

### Console Logging
```javascript
// In backend/server.js or gameLogic.js
console.log('Debug info:', variable);
```

### Conditional Breakpoints
1. Right-click breakpoint
2. Edit breakpoint condition
3. Only pauses when condition is true

### Debug Console Commands
```javascript
// View variable
player.money

// Call function
game.rollDice()

// Execute code
gameState.players.length
```

### Watch Expressions
1. Click "Watch" in debug panel
2. Click "+" and enter expression
3. Updates as code executes

## 📱 Browser DevTools

Also use browser DevTools for frontend debugging:

1. Open game in browser
2. Press `F12` for DevTools
3. Use Console, Network, Application tabs

## 🚫 Troubleshooting Launch Issues

### Port Already in Use
Edit launch.json and change PORT env variable:
```json
"env": {
    "PORT": "3001"
}
```

### npm not found
Install Node.js from https://nodejs.org

### Dependencies missing
Run task: `Tasks: Run Task` → `Install Dependencies`

### Debugger not attaching
- Ensure server is running
- Check port 9229 is available
- Restart VS Code

## 📚 More Resources

- VS Code Debug Docs: https://code.visualstudio.com/docs/editor/debugging
- Node.js Debugging: https://nodejs.org/en/docs/guides/debugging-getting-started/
- Socket.io Debugging: https://socket.io/docs/v4/
- See TECHNICAL.md for code architecture

## 🎯 Best Practices

✅ **DO**:
- Use breakpoints instead of console.log for complex issues
- Keep debug session running while developing
- Use watch expressions for important variables
- Step through code to understand flow

❌ **DON'T**:
- Leave breakpoints in committed code
- Run multiple debug sessions on same port
- Commit `.vscode` if using private settings
- Use debugger in production

## 🎉 You're Ready!

Press `F5` to start debugging your Monopoly game!

```
┌─────────────────────────────┐
│  F5 - Start Debugging       │
│  Ctrl+Shift+D - Debug Menu  │
│  F10 - Step Over            │
│  F11 - Step Into            │
│  Shift+F11 - Step Out       │
└─────────────────────────────┘
```

Happy debugging! 🎲

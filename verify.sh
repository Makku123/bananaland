#!/bin/bash
# Project verification script
# This script checks that all required files are in place

echo "=== Monopoly Game - Project Verification ==="
echo ""

# Check root files
echo "Checking root directory files..."
files=("README.md" "QUICKSTART.md" "TECHNICAL.md" "DEPLOYMENT.md" "INDEX.md" "Procfile" ".gitignore" "start.bat" "start.sh")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file - MISSING"
    fi
done

echo ""
echo "Checking backend files..."
backend_files=("backend/package.json" "backend/server.js" "backend/gameLogic.js")
for file in "${backend_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file - MISSING"
    fi
done

echo ""
echo "Checking frontend files..."
frontend_files=("frontend/index.html" "frontend/styles.css" "frontend/game.js" "frontend/board.js")
for file in "${frontend_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file - MISSING"
    fi
done

echo ""
echo "=== Verification Complete ==="
echo ""
echo "To start the game:"
echo ""
echo "1. Navigate to the backend folder:"
echo "   cd backend"
echo ""
echo "2. Install dependencies (first time only):"
echo "   npm install"
echo ""
echo "3. Start the server:"
echo "   npm start"
echo ""
echo "4. Open browser and go to:"
echo "   http://localhost:3000"
echo ""
echo "Happy playing! 🎲🏠"

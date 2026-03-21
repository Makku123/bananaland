#!/bin/bash

# Monopoly Game - Unix/Mac Startup Script

echo "Starting Monopoly Game..."
echo ""

cd backend

echo "Installing dependencies..."
npm install

echo ""
echo "Starting server on http://localhost:3000"
echo "Open your browser and navigate to http://localhost:3000"
echo ""

npm start

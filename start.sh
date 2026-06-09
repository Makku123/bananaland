#!/bin/bash
# Monkey Business - Mac/Linux startup script
set -e

cd "$(dirname "$0")/backend"

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is required but was not found. Install it from https://nodejs.org"
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install
fi

PORT="${PORT:-3000}"
URL="http://localhost:$PORT"

echo "Starting Monkey Business on $URL"
# Open the browser once the server is up
(sleep 2 && { command -v open >/dev/null && open "$URL" || { command -v xdg-open >/dev/null && xdg-open "$URL"; }; }) >/dev/null 2>&1 &

PORT="$PORT" npm start

#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# The remote host is now passed as the first argument to the script.
if [ -z "$1" ]; then
    echo "Usage: ./deploy.sh <remote_host>"
    echo "Example: ./deploy.sh 143.198.117.234"
    exit 1
fi
REMOTE_HOST=$1
REMOTE_USER="root"
APP_NAME="universes"
# Directory on the server where the website files will be stored
REMOTE_APP_DIR="/var/www/universes"
# Directory on the server for the Caddy configuration
REMOTE_CADDY_CONFIG_DIR="/etc/caddy"

# --- 1. Build the application ---
echo "Building the React application..."
npm run build
echo "Build complete."

# --- 2. Copy files to the server ---
echo "Connecting to server to create directories..."
ssh $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_APP_DIR && mkdir -p $REMOTE_CADDY_CONFIG_DIR"

echo "Copying application files to $REMOTE_HOST..."
# Use rsync to efficiently copy the build output. The --delete flag removes old files.
rsync -avz --delete ./dist/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_APP_DIR/

echo "Copying Caddyfile to $REMOTE_HOST..."
scp ./Caddyfile $REMOTE_USER@$REMOTE_HOST:$REMOTE_CADDY_CONFIG_DIR/Caddyfile
echo "Files copied."

# --- 3. Deploy on the server via SSH ---
echo "Connecting to $REMOTE_HOST to set up and deploy..."
ssh $REMOTE_USER@$REMOTE_HOST << EOF
    # --- Install Docker if not present ---
    if ! command -v docker &> /dev/null; then
        echo "Docker not found. Installing Docker..."
        # Use the official script to install Docker
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
        echo "Docker installed successfully."
    else
        echo "Docker is already installed."
    fi

    # --- Deploy Caddy Container ---
    echo "Pulling latest Caddy image..."
    docker pull caddy:2-alpine

    # Stop and remove the existing container if it's running
    echo "Stopping and removing existing container..."
    docker stop $APP_NAME || true
    docker rm $APP_NAME || true

    # Run the new Caddy container
    echo "Starting new Caddy container..."
    docker run -d \
        --name $APP_NAME \
        --restart always \
        -p 80:80 \
        -p 443:443 \
        -v $REMOTE_APP_DIR:/usr/share/caddy \
        -v $REMOTE_CADDY_CONFIG_DIR/Caddyfile:/etc/caddy/Caddyfile \
        -v caddy_data:/data \
        caddy:2-alpine

    echo "Caddy container is running."
EOF

echo "🚀 Deployment to $REMOTE_HOST finished successfully!"
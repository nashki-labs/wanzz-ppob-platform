#!/bin/bash

# Configuration
VPS_USER="root"
VPS_IP=$1
SSH_PORT=${2:-22} # Default to port 22 if not provided

# If user is root, home is /root, otherwise /home/user
if [ "$VPS_USER" == "root" ]; then
    DEST_DIR="/root/wanzz-ppob-platform"
else
    DEST_DIR="/home/$VPS_USER/wanzz-ppob-platform"
fi

if [ -z "$VPS_IP" ]; then
    echo "❌ Usage: ./deploy.sh <VPS_IP> [SSH_PORT]"
    exit 1
fi

echo "🚀 Starting deployment to $VPS_IP on port $SSH_PORT..."

# SSH Multiplexing Setup
# This creates a master connection so subsequent ssh/rsync calls reuse it
# and only ask for the password once.
SSH_CONTROL_PATH="/tmp/ssh-control-$(date +%s)"
SSH_OPTS="-o ControlMaster=auto -o ControlPath=$SSH_CONTROL_PATH -o ControlPersist=600 -p $SSH_PORT"

# Cleanup function to close the master connection on exit
cleanup() {
    echo "🧹 Cleaning up SSH connection..."
    ssh $SSH_OPTS -O exit $VPS_USER@$VPS_IP 2>/dev/null
    rm -f $SSH_CONTROL_PATH
}
trap cleanup EXIT

# Establish the master connection (this will ask for password once)
echo "🔑 Establishing SSH connection..."
ssh $SSH_OPTS -N -f $VPS_USER@$VPS_IP

# Step 0: Ensure directory exists on VPS
echo "📁 Ensuring destination directory exists..."
ssh $SSH_OPTS $VPS_USER@$VPS_IP "mkdir -p $DEST_DIR"

# Step 1: Transfer files
echo "📤 Transferring files..."
rsync -avz -e "ssh $SSH_OPTS" --exclude 'node_modules' --exclude '.git' --exclude 'dist' ./ $VPS_USER@$VPS_IP:$DEST_DIR

# Step 2: Run Docker Compose on VPS
echo "🐳 Building and starting containers on VPS..."
ssh $SSH_OPTS $VPS_USER@$VPS_IP << EOF
    cd $DEST_DIR
    docker compose down
    docker compose up -d --build
EOF

echo "✅ Deployment finished successfully!"

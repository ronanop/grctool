#!/bin/bash
# Optional setup script for Ubuntu 22.04+ (ISO 27001 Compliance Portal)
# Review and run step-by-step; adjust paths and versions as needed.
# Usage: sudo bash deploy/setup-ubuntu.sh

set -e
APP_DIR="${APP_DIR:-/var/app/decgrc}"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

echo "=== 1. Firewall (optional) ==="
echo "Allow SSH, HTTP, HTTPS; deny 8000, 5173, 27017 from public:"
echo "  ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable"
echo "Press Enter to skip or run the above manually..."
read -r

echo "=== 2. MongoDB (if self-hosting) ==="
if command -v mongod &>/dev/null; then
  echo "MongoDB already installed."
  systemctl enable mongod 2>/dev/null || true
  systemctl start mongod 2>/dev/null || true
else
  echo "Install MongoDB Community: https://www.mongodb.com/docs/manual/administration/install-on-linux/"
  echo "Or use MongoDB Atlas and set MONGODB_URI in .env. Continue? [y/N]"
  read -r r
  [ "$r" = "y" ] || [ "$r" = "Y" ] || exit 1
fi

echo "=== 3. Python and backend ==="
if [ ! -d "$BACKEND_DIR" ]; then
  echo "Backend dir not found at $BACKEND_DIR. Clone or copy the repo first."
  exit 1
fi
cd "$BACKEND_DIR"
python3 -m venv venv
# shellcheck source=/dev/null
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Edit backend/.env and set MONGODB_URI and SECRET_KEY, then re-run from step 4."
  exit 0
fi

echo "=== 4. Uploads and Chroma dirs ==="
mkdir -p uploads chroma_data
# If using absolute paths in .env, create them too
# mkdir -p /var/app/decgrc/uploads /var/app/decgrc/chroma_data

echo "=== 5. Create admin user ==="
python create_admin.py || true

echo "=== 6. Node and frontend build ==="
if ! command -v node &>/dev/null; then
  echo "Install Node 18+ (e.g. nvm or NodeSource). Then re-run from this step."
  exit 1
fi
cd "$FRONTEND_DIR"
npm ci
echo "Set VITE_API_BASE_URL (e.g. https://yourdomain.com) for production build."
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://localhost}"
npm run build

echo "=== 7. Nginx and systemd ==="
echo "Copy deploy/nginx-decgrc.conf to /etc/nginx/sites-available/, edit server_name and root, enable site, reload nginx."
echo "Copy deploy/decgrc-backend.service to /etc/systemd/system/, edit paths and User/EnvironmentFile, then:"
echo "  systemctl daemon-reload && systemctl enable --now decgrc-backend.service"
echo "Done."

# Deployment Guide – ISO 27001 Compliance Portal

This guide covers deploying the app on Ubuntu. For the full checklist, see the Ubuntu Deployment Plan.

## Prepare code for the server

Do **not** copy `node_modules/`, `venv/`, or `.env` to the server. Recreate them on the server.

### Option A: Git clone (recommended)

On the server:

```bash
git clone <your-repo-url> decgrc
cd decgrc
# Then follow Ubuntu server checklist below
```

### Option B: Tarball from your machine

From the project root (excluding ignored files):

```bash
git archive --format=tar.gz --output=decgrc-deploy.tar.gz HEAD
```

Or with rsync to a folder (then tar that folder):

```bash
rsync -av --exclude='node_modules' --exclude='frontend/node_modules' \
  --exclude='venv' --exclude='backend/venv' --exclude='.env' \
  --exclude='backend/.env' --exclude='backend/uploads' \
  --exclude='backend/chroma_data' --exclude='frontend/dist' \
  . /tmp/decgrc-deploy
tar -czvf decgrc-deploy.tar.gz -C /tmp decgrc-deploy
```

Copy `decgrc-deploy.tar.gz` to the server and extract.

## Ubuntu server setup

The following artifacts are in this repo:

- **[deploy/nginx-decgrc.conf](deploy/nginx-decgrc.conf)** – Nginx server block (static + API proxy)
- **[deploy/decgrc-backend.service](deploy/decgrc-backend.service)** – systemd unit for the FastAPI backend
- **[deploy/setup-ubuntu.sh](deploy/setup-ubuntu.sh)** – Optional script to install MongoDB, Node, Python, and create dirs (review before running)

After copying code to the server (e.g. `/var/app/decgrc`):

1. **Backend**: Copy [backend/.env.example](backend/.env.example) to `backend/.env`, set `MONGODB_URI` and `SECRET_KEY` at minimum. Create `uploads` and `chroma_data` dirs. Create venv and install deps; create admin user.
2. **Frontend**: Set `VITE_API_BASE_URL` to your public API URL, then `npm ci` and `npm run build`.
3. **Nginx**: Install Nginx, copy `deploy/nginx-decgrc.conf` to `/etc/nginx/sites-available/`, symlink to `sites-enabled`, set server_name and paths, run certbot for SSL, reload Nginx.
4. **Backend service**: Copy `deploy/decgrc-backend.service` to `/etc/systemd/system/`, edit paths and EnvironmentFile, then `systemctl enable --now decgrc-backend.service`.

See the plan for the full step-by-step checklist and environment variable reference.

## Post-deploy smoke test

- [ ] Frontend loads over HTTPS (no blank page).
- [ ] Login page appears; log in with admin credentials created in setup.
- [ ] After login, dashboard or default route loads.
- [ ] API calls succeed (check browser Network tab for `/api/v1/`; no CORS or 502).
- [ ] File upload (e.g. policy or proof) works; file appears under `UPLOAD_DIR`.
- [ ] (Optional) Chatbot works if `OPENAI_API_KEY` is set.
- [ ] Backend logs: `journalctl -u decgrc-backend.service -f`.
- [ ] Nginx access/error: `tail -f /var/log/nginx/access.log` and `error.log`.

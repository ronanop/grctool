# Deployment artifacts

- **nginx-decgrc.conf** – Nginx server block: static frontend + `/api` proxy to FastAPI. Copy to `/etc/nginx/sites-available/`, edit `server_name` and `root`, enable site, then `nginx -t && systemctl reload nginx`. Use certbot for SSL.
- **decgrc-backend.service** – systemd unit for the backend. Copy to `/etc/systemd/system/`, edit `WorkingDirectory`, `ExecStart`, and `EnvironmentFile` (path to `backend/.env`). If the app runs under a different user (e.g. your deploy user), change `User=` and `Group=` or remove them. Then `systemctl daemon-reload && systemctl enable --now decgrc-backend.service`.
- **setup-ubuntu.sh** – Optional helper script for Ubuntu (MongoDB check, Python venv, backend deps, uploads/chroma dirs, admin user, Node, frontend build). Review and run step-by-step; set `APP_DIR` if not `/var/app/decgrc`.

## Firewall and DNS (Ubuntu)

- **Firewall**: Allow SSH (22), HTTP (80), HTTPS (443). Do not expose 8000, 5173, or 27017 publicly.
  ```bash
  ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
  ```
- **DNS**: Point your domain A record to the server IP so Nginx and certbot can use the domain.

# Deployment and VPS Management

This guide explains how to deploy changes to the production VPS and manage the server operations.

## Deployment Workflow (Recommended)

To avoid syntax errors and corrupted files on the server, **always code and test locally** first, then sync using Git.

### 1. Locally
```bash
git add .
git commit -m "Describe your changes"
git push origin main
```

### 2. On the VPS (Syncing)
SSH into your VPS and go to `/root/chat-new`.
```bash
# Force the VPS to match GitHub exactly (replaces local typos)
git fetch origin
git reset --hard origin/main
```

---

## Service Management

### Backend (PM2)
The backend runs outside Docker for better performance and easier debugging.
- **Restart API**: `pm2 restart krovaa-api`
- **Apply .env changes**: `pm2 restart krovaa-api --update-env`
- **View Logs**: `pm2 logs krovaa-api`
- **Hard Restart (if cached)**:
  ```bash
  pm2 delete all
  pm2 start /root/chat-new/backend/ecosystem.config.cjs
  ```

### Frontend (Docker)
The frontend is containerized using Nginx.
- **Rebuild UI**: `docker-compose build frontend`
- **Restart UI**: `docker-compose up -d frontend`
- **View UI Logs**: `docker logs krovaa-frontend`

### Database (Docker)
PostgreSQL runs in a container.
- **Restart DB**: `docker-compose start postgres`
- **Check Status**: `docker ps`

---

## Direct Database Access
If you need to promote an admin or fix a record manually:
```bash
cd /root/chat-new/backend
node promote.js user@example.com
```

---

## The "Nuclear Option" (Clean Reset)
If the server is throwing 502 or 535 errors and you can't figure out why:
```bash
cd /root/chat-new
git fetch origin
git reset --hard origin/main
pm2 delete all
pm2 start /root/chat-new/backend/ecosystem.config.cjs
docker-compose up -d --build frontend
```
This forces everything to the latest clean state from GitHub.

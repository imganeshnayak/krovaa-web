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

---

## Hostinger VPS Maintenance

For your specific deployment on Hostinger, follow these routines to keep the system healthy.

### 1. System Health Checks
Monitor the server load and disk space to prevent unexpected crashes:
```bash
# Check disk usage (if / is 90%+, clear logs)
df -h

# Check RAM usage
free -h

# Monitor CPU and processes
top
```

### 2. Log Management
Logs can grow very large and fill up your disk.
- **PM2 Logs**: `pm2 flush` (clears all current logs)
- **Docker Logs**: `docker-compose logs --tail=100` (to view just the recent ones)
- **Nginx Logs**: Found in `/var/log/nginx/access.log` and `error.log`.

### 3. Database Backups
Before making major changes, manually backup your Postgres volume:
```bash
docker exec krovaa-postgres pg_dumpall -U postgres > /root/backups/db_backup_$(date +%F).sql
```

### 4. SSL Management
If you are using Hostinger's standard Nginx setup with Certbot:
```bash
# Check SSL certificate status
certbot certificates

# Force a renewal test
certbot renew --dry-run
```

---

&copy; 2026 Krovaa Project

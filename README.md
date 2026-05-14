# Krovaa — Premium Service Platform

Krovaa is a state-of-the-art platform for connecting clients with vendors, featuring escrow payments, Telegram integration, and a premium aesthetic.

## 📚 Project Documentation

We have prepared comprehensive documentation to help you manage and develop this project:

- **[Architecture Overview](documentation/architecture.md)**: Deep dive into the tech stack and system modules.
- **[Configuration Guide](documentation/configuration.md)**: Details on all environment variables and secrets.
- **[Setup Guide](documentation/setup_guide.md)**: Step-by-step instructions for local development.
- **[Deployment & Operations](documentation/deployment_ops.md)**: How to sync with the VPS and manage production services.

## 🚀 Quick Start (Production)

To sync the latest changes to your VPS:

```bash
cd /root/chat-new
git fetch origin
git reset --hard origin/main
pm2 delete all
pm2 start /root/chat-new/backend/ecosystem.config.cjs
docker-compose up -d --build frontend
```

---

&copy; 2026 Krovaa Project
updated

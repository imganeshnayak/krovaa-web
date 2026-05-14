# Environment Setup Guide

## Prerequisites
Before starting the backend, you need to set up the environment configuration file.

## Setup Steps

### 1. Create `.env` File from Template
```bash
# From project root
cp .env.example .env
```

### 2. Edit `.env` with Your Credentials
Open `.env` and fill in the following required values:

#### Database
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5433/krovaa_chat
```
- Replace `YOUR_PASSWORD` with your PostgreSQL password
- Use `localhost:5433` if running on host (Docker PostgreSQL mapped port)
- Use `database:5432` if backend runs in Docker

#### Email Service (Zoho SMTP)
```
EMAIL_HOST=smtp.zoho.in
EMAIL_PORT=465
EMAIL_USER=your_email@zoho.com
EMAIL_PASS=your_app_specific_password
```

#### Cloudinary (Image Upload)
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=xxxxxxxxxxxxx
CLOUDINARY_API_SECRET=xxxxxxxxxxxxx
```
Get these from: https://cloudinary.com/console

#### Telegram Bot
```
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
```

#### Razorpay (Payments)
```
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
```
Use **test credentials** for development!

#### JWT Secret
```
JWT_SECRET=your_secret_key_minimum_32_characters_long
```

#### Frontend URLs
```
FRONTEND_URL=https://krovaa.com      # Production
VITE_API_URL=https://krovaa.com/api  # Production
VITE_TELEGRAM_BOT_NAME=your_bot_username
```

For **local development**, use:
```
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:5000/api
```

### 3. Verify Environment Variables Are Loaded

Run the backend and check for no `undefined` errors:
```bash
cd backend
npm install
npm run dev
```

Check logs for successful startup:
```
✓ Server running on http://localhost:5000
✓ Connected to database
```

---

## Important Notes

⚠️ **Security:**
- **NEVER** commit `.env` file to Git (it's in `.gitignore`)
- **NEVER** commit `.env.example` with real credentials
- Keep `JWT_SECRET` and passwords secure

🔧 **Development vs Production:**
- Development: Use local URLs (localhost:5000, localhost:5173)
- Production: Use domain URLs (https://krovaa.com)
- Use Razorpay **test credentials** during development

🐳 **Docker Setup:**
- Database is running in Docker (krovaa-db)
- Backend can run on host (via PM2) or in container
- Frontend runs in container (nginx)

---

## Troubleshooting

### Backend Won't Start
1. Check all required env vars are set: `DATABASE_URL`, `JWT_SECRET`, etc.
2. Ensure PostgreSQL is running: `docker-compose up -d database`
3. Check `.env` is in project root, not backend/ directory

### Database Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:5433
```
- Ensure PostgreSQL container is running: `docker-compose ps`
- Check `DATABASE_URL` is correct

### Email Not Sending
- Verify `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`
- Ensure Zoho app-specific password is being used (not main password)

### JWT Errors
- Ensure `JWT_SECRET` is set and longer than 32 characters
- Restart backend after changing `JWT_SECRET`

---

## Next Steps

After setting up `.env`:

1. **Start Database:**
   ```bash
   docker-compose up -d database
   ```

2. **Setup Database Schema:**
   ```bash
   cd backend
   npm run db:setup
   ```

3. **Start Backend:**
   ```bash
   npm run dev
   ```

4. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

For production deployment, see: `/documentation/deployment_ops.md`

# Configuration and Environment Variables

The project uses environment variables (`.env` files) to manage sensitive information and service endpoints. These files are excluded from version control for security.

---

## ⚙️ Quick Setup

### Step 1: Create Root `.env` File
Copy the example file and fill in your credentials:
```bash
cp .env.example .env
# Edit .env with your actual values
```

### Step 2: Environment Files Location
- **Root `.env`** - Served to backend via PM2 and Docker Compose
- **Backend** - Reads from root `.env` (configured in `backend/server.js`)
- **Frontend** - Uses `VITE_` prefixed variables from Docker build args and `.env` file

---

## 📋 Root `.env` (Project Root)

This is the **primary configuration file** used by both:
- PM2 process manager (via `backend/ecosystem.config.cjs`)
- Docker Compose services
- Backend application server

### Backend-Related Variables:
```env
# Server
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5433/krovaa_chat

# Authentication
JWT_SECRET=your_jwt_secret_key_here_min_32_chars

# Email Service
EMAIL_HOST=smtp.zoho.in
EMAIL_PORT=465
EMAIL_USER=your_email@zoho.com
EMAIL_PASS=your_app_specific_password

# Image Upload
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Bot & Notifications
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Payments
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### Docker & Frontend Variables:
```env
# Frontend URLs
FRONTEND_URL=https://krovaa.com
VITE_API_URL=https://krovaa.com/api
VITE_TELEGRAM_BOT_NAME=your_bot_username

# Database Initialization
POSTGRES_PASSWORD=postgres
POSTGRES_USER=postgres
POSTGRES_DB=krovaa_chat

# PGAdmin (optional)
PGADMIN_DEFAULT_EMAIL=admin@krovaa.com
PGADMIN_DEFAULT_PASSWORD=secure_password
```

---

## 🔍 How Backend Accesses Environment Variables

The backend server (`backend/server.js`) loads environment variables from the **root `.env`** file:

```javascript
// backend/server.js
dotenv.config({ path: path.join(__dirname, '..', '.env') });
// Loads from: project-root/.env (not backend/.env)
```

**Key Point:** The backend does NOT use a separate `backend/.env`. All variables are served from the root `.env` file.

---

## ⚡ PM2 Environment Variables

When running the backend via PM2, the `backend/ecosystem.config.cjs` file passes environment variables from root `.env` to the application:

```javascript
// backend/ecosystem.config.cjs
env: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT || 5000,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    // ... other variables
}
```

**To add a new variable:**
1. Add it to root `.env`
2. Add it to the `env` section in `backend/ecosystem.config.cjs`
3. Restart PM2: `pm2 restart all`

---

## 🐳 Docker Networking

If the backend is running on the host machine (via PM2) while PostgreSQL is in a Docker container:
- Use `localhost:5433` in `DATABASE_URL`
- This maps to the host port in `docker-compose.yml` (5433:5432)

For containerized backend (Docker Compose):
- Use `database:5432` (internal Docker network)
- Container name resolves automatically within the network

---

## 📁 Example Files

- **`.env.example`** - Production configuration template
- **`.env.local.example`** - Development configuration template
- **`.gitignore`** - Ensures `.env` is never committed

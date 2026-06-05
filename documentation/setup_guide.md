# Local Development Setup Guide

Follow these steps to set up and run the Krovaa project on your local machine for development.

## Prerequisites
- **Node.js**: v18 or later
- **npm**: v8 or later
- **PostgreSQL**: v14 or later (or Docker Desktop to run via container)
- **Git**: For version control

---

## 1. Clone the Repository
```bash
git clone https://github.com/imganeshnayak/chat.git
cd chat
```

## 2. Backend Setup

### Install Dependencies
```bash
cd backend
npm install
```

### Configuration
Create a `.env` file in the `backend/` directory and populate it with your local credentials (refer to `configuration.md`).

### Database Initialization
If using Docker, start the Postgres container:
```bash
docker-compose up -d database
```

Generate Prisma client and push the schema to your database:
```bash
npx prisma generate
npx prisma db push
```

(Optional) Seed the database with demo data:
```bash
npm run db:seed
```

### Run the Backend
```bash
npm run dev
```
The API will be available at `http://localhost:5000`.

---

## 3. Frontend Setup

### Install Dependencies
```bash
cd ../frontend
npm install
```

### Configuration
Create a `.env` file in the `frontend/` directory:
```env
VITE_API_URL=http://localhost:5000
VITE_TELEGRAM_BOT_NAME=your_test_bot_username
```

### Run the Frontend
```bash
npm run dev
```
The application will be available at `http://localhost:5173`.

---

## 4. Useful Development Commands

- `npm run dev`: Starts the server with auto-reload (backend uses `node --watch`).
- `npx prisma studio`: Visual interface to browse and edit your database records.
- `npx prisma db push`: Syncs your `schema.prisma` changes with the database.

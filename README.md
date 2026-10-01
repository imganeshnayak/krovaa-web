# Krovaa Web

Krovaa is a full-stack platform that connects users for jobs, collaboration, messaging, and secure payments.
This repository contains:

- **Frontend**: React + TypeScript (Vite)
- **Backend**: Node.js + Express + Prisma
- **Database**: PostgreSQL
- **Infra**: Docker Compose + PM2-ready backend config

---

## Project Structure

```text
.
├── frontend/              # Vite + React app
├── backend/               # Express API + Prisma schema
├── documentation/         # Architecture, setup, deployment docs
├── docker-compose.yml     # Local containers (DB, frontend, pgAdmin)
└── .env.example           # Root environment template
```

---

## Key Features

- Authentication and user profile management
- Real-time messaging (Socket.IO)
- Jobs, posts, teams, and collaboration workflows
- Wallet, escrow, and Razorpay payment integrations
- Cloudinary media uploads
- Telegram bot integration (login/notifications)
- Admin and moderation APIs

---

## Tech Stack

### Frontend (`/frontend`)
- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- React Router + React Query
- Vitest for tests

### Backend (`/backend`)
- Node.js + Express (ES Modules)
- Prisma ORM
- PostgreSQL
- Socket.IO
- Nodemailer, Cloudinary, Razorpay integrations

---

## Prerequisites

- Node.js **18+**
- npm **8+**
- Docker (recommended for local PostgreSQL)
- Git

---

## Environment Setup

1. Copy the root environment template:

```bash
cp .env.example .env
```

2. Update required values in `.env`:
- `DATABASE_URL`
- `JWT_SECRET`
- `EMAIL_*`
- `CLOUDINARY_*`
- `TELEGRAM_BOT_TOKEN`
- `RAZORPAY_*`
- `VITE_API_URL`, `FRONTEND_URL`

> The backend reads env vars from the **root `.env`** file (not `backend/.env`).

For full variable documentation, see [`documentation/configuration.md`](documentation/configuration.md).

---

## Local Development

### 1) Start PostgreSQL (Docker)

```bash
docker-compose up -d database
```

### 2) Backend setup and run

```bash
cd backend
npm install
npm run db:setup
npm run dev
```

Backend runs at `http://localhost:5000`.

### 3) Frontend setup and run

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## Common Commands

### Backend (`/backend`)
- `npm run dev` — start backend in watch mode
- `npm run start` — start backend
- `npm run db:push` — push Prisma schema
- `npm run db:seed` — seed database
- `npm run db:setup` — push schema + seed
- `npm run db:studio` — open Prisma Studio

### Frontend (`/frontend`)
- `npm run dev` — start Vite dev server
- `npm run build` — production build
- `npm run preview` — preview build
- `npm run lint` — run ESLint
- `npm run test` — run unit tests

---

## Docker Services

Defined in [`docker-compose.yml`](docker-compose.yml):

- `database` (PostgreSQL) → host port `5433`
- `frontend` (Nginx build output) → host port `3000`
- `pgadmin` (optional) → host port `5055`

Start all services:

```bash
docker-compose up -d
```

---

## API Base URL

Backend API routes are exposed under `/api/*` (example: `/api/auth`, `/api/users`, `/api/messages`).

For local frontend development, set:

```env
VITE_API_URL=http://localhost:5000/api
```

---

## Documentation Index

- [Architecture](documentation/architecture.md)
- [Configuration](documentation/configuration.md)
- [Setup Guide](documentation/setup_guide.md)
- [Deployment & Operations](documentation/deployment_ops.md)
- [Color Theme Guide](documentation/COLOR_THEME_GUIDE.md)
- [Community Feature Notes](documentation/community_feature.md)

---

## Notes

- Do not commit `.env` or any secrets.
- Use test credentials for payment providers in local/dev environments.

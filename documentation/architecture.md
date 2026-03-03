# Krovaa Project Architecture

This document provides a technical overview of the Krovaa project architecture, tech stack, and third-party integrations.

## Tech Stack

### Frontend
- **Framework**: React.js (via Vite)
- **Language**: TypeScript
- **Styling**: Vanilla CSS (Premium aesthetics with glassmorphism and animations)
- **Deployment**: Dockerized (Nginx)

### Backend
- **Framework**: Express.js (Node.js)
- **Language**: JavaScript (ES Modules)
- **Database ORM**: Prisma
- **Process Manager**: PM2

### Infrastructure
- **Web Server**: Nginx (Reverse Proxy for Docker and PM2)
- **Database**: PostgreSQL (Containerized)
- **Platform**: Linux VPS (Ubuntu)

## Core Integrations

### Email (Zoho Mail)
- **Service**: Zoho SMTP
- **Protocol**: SMTP via Nodemailer
- **Usage**: Sending OTPs for registration and password resets.
- **Note**: Account is region-specific (Zoho India/International).

### Payments (Razorpay)
- **Mode**: Test/Production
- **Usage**: Subscription payments, escrow funding, and payouts.
- **Services**: Payouts API and Payment Gateway.

### Media (Cloudinary)
- **Usage**: Image hosting for user avatars and cover photos.
- **Integration**: Cloudinary SDK with Multer for handling uploads.

### Telegram
- **Integration**: Telegram Bot API
- **Usage**: Telegram login/authentication and notification bot.

## Module Overview

### Backend Structure
- `/routes`: API endpoints (Auth, Users, Escrow, Payments, etc.)
- `/services`: Business logic for third-party integrations (Email, Razorpay)
- `/prisma`: Database schema and migrations
- `/config`: Configuration for external services

### Frontend Structure
- `/src/pages`: Main application views
- `/src/components`: Reusable UI elements
- `/src/context`: State management (Auth, Theme)

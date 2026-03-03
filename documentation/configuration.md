# Configuration and Environment Variables

The project uses environment variables (`.env` files) to manage sensitive information and service endpoints. These files are excluded from version control for security.

## Global `.env` (Project Root)
This file is used by Docker Compose and high-level scripts.
- `DATABASE_URL`: Connection string for PostgreSQL.
- `JWT_SECRET`: Secret key for signing JSON Web Tokens.
- `EMAIL_HOST`: SMTP host (e.g., `smtp.zoho.in`).
- `EMAIL_PORT`: SMTP port (e.g., `465`).
- `EMAIL_USER`: Sender email address.
- `EMAIL_PASS`: SMTP password or app-specific password.

## Backend `.env` (`/backend/.env`)
The backend requires several integration-specific variables.
- `PORT`: Port on which the API server runs (default: `5000`).
- `CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name.
- `CLOUDINARY_API_KEY`: Cloudinary API key.
- `CLOUDINARY_API_SECRET`: Cloudinary API secret.
- `TELEGRAM_BOT_TOKEN`: Token for the Telegram notification/login bot.
- `RAZORPAY_KEY_ID`: Razorpay public key ID.
- `RAZORPAY_KEY_SECRET`: Razorpay secret key.

## Frontend `.env` (`/frontend/.env`)
Frontend variables are prefixed with `VITE_` for exposure to the build process.
- `VITE_API_URL`: Base URL for the backend API (e.g., `https://krovaa.com/api`).
- `VITE_TELEGRAM_BOT_NAME`: Username of the Telegram bot used for login.

---

## Important Usage Notes

### PM2 Environment Variables
When running the backend via PM2, environment variables from `.env` are passed through the `ecosystem.config.cjs` file. If you add a new variable to `.env`, you may need to explicitly add it to the `env` section of the PM2 config:

```javascript
// backend/ecosystem.config.cjs
env: {
    NODE_ENV: 'production',
    NEW_VAR: process.env.NEW_VAR,
}
```

### Docker Networking
If the backend is running on the host machine (via PM2) while PostgreSQL is in a Docker container, use `localhost:5433` (or your mapped host port) in the `DATABASE_URL` rather than the Docker internal IP.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
    apps: [
        {
            name: 'krovaa-api',
            script: 'server.js',
            cwd: __dirname,          // Ensure correct working directory
            instances: 1,            // Start with 1 instance (Prisma works better in fork mode)
            exec_mode: 'fork',       // Fork mode is more stable with Prisma
            watch: false,            // Never watch in production
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production',
                // All environment variables loaded from root .env via dotenv.config() above
                PORT: process.env.PORT || 5000,
                DATABASE_URL: process.env.DATABASE_URL,
                JWT_SECRET: process.env.JWT_SECRET,
                // Cloudinary
                CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
                CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
                CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
                // Telegram
                TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
                // Razorpay
                RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
                RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
                // Email
                EMAIL_HOST: process.env.EMAIL_HOST,
                EMAIL_PORT: process.env.EMAIL_PORT,
                EMAIL_USER: process.env.EMAIL_USER,
                EMAIL_PASS: process.env.EMAIL_PASS,
                // Frontend
                FRONTEND_URL: process.env.FRONTEND_URL,
            },
            // Auto-restart on crash, with exponential backoff
            restart_delay: 1000,
            max_restarts: 10,
            // Logging
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            out_file: path.join(__dirname, 'logs', 'out.log'),
            error_file: path.join(__dirname, 'logs', 'error.log'),
            merge_logs: true,
        },
    ],
};

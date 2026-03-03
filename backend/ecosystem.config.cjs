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
                // Database — PM2 runs outside Docker so must use the host-mapped port
                DATABASE_URL: 'postgresql://postgres:admin123@localhost:5433/krovaa_chat?schema=public',
                // Email
                EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.zoho.in',
                EMAIL_PORT: process.env.EMAIL_PORT || '465',
                EMAIL_USER: process.env.EMAIL_USER,
                EMAIL_PASS: process.env.EMAIL_PASS,
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

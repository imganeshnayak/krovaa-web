import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the backend directory
dotenv.config({ path: 'c:/Users/User/Downloads/project1/backend/.env' });

console.log('Testing email with:', {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER,
    pass: '********'
});

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    debug: true, // Enable debug
    logger: true  // Enable logger
});

transporter.verify((err, success) => {
    if (err) {
        console.error('Verify Error:', err);
    } else {
        console.log('Server is ready to take our messages');
    }
    process.exit();
});

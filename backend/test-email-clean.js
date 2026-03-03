import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'c:/Users/User/Downloads/project1/backend/.env' });

async function test() {
    console.log('--- Testing 587 (TLS) ---');
    const t587 = nodemailer.createTransport({
        host: 'smtp.zoho.in',
        port: 587,
        secure: false,
        auth: { user: 'noreply@krovaa.com', pass: 'fnTbYuxi9nNh' }
    });
    try {
        await t587.verify();
        console.log('587 OK');
    } catch (e) {
        console.log('587 FAIL:', e.message);
    }

    console.log('\n--- Testing 465 (SSL) ---');
    const t465 = nodemailer.createTransport({
        host: 'smtp.zoho.in',
        port: 465,
        secure: true,
        auth: { user: 'noreply@krovaa.com', pass: 'fnTbYuxi9nNh' }
    });
    try {
        await t465.verify();
        console.log('465 OK');
    } catch (e) {
        console.log('465 FAIL:', e.message);
    }
}

test();

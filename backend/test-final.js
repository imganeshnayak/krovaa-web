import nodemailer from 'nodemailer';

async function test() {
    console.log('--- FINAL TEST ---');
    const transporter = nodemailer.createTransport({
        host: 'smtp.zoho.in',
        port: 587,
        secure: false,
        auth: {
            user: 'noreply@krovaa.com',
            pass: '7phCMjYJKysr'
        }
    });

    try {
        await transporter.verify();
        console.log('SUCCESS: Connection verified!');
    } catch (e) {
        console.log('FAILURE: ' + e.message);
    }
}

test();

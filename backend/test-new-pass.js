import nodemailer from 'nodemailer';

async function test() {
    console.log('--- Testing NEW App Password (SSL 465) ---');
    const t465 = nodemailer.createTransport({
        host: 'smtppro.zoho.in',
        port: 465,
        secure: true,
        auth: {
            user: 'noreply@krovaa.com',
            pass: '7phCMjYJKysr'
        }
    });

    try {
        await t465.verify();
        console.log('✅ 465 OK - PASSWORD WORKS');
    } catch (e) {
        console.log('❌ 465 FAIL:', e.message);

        console.log('\n--- Retrying with standard Host (SSL 465) ---');
        const t465_std = nodemailer.createTransport({
            host: 'smtp.zoho.in',
            port: 465,
            secure: true,
            auth: { user: 'noreply@krovaa.com', pass: '7phCMjYJKysr' }
        });
        try {
            await t465_std.verify();
            console.log('✅ 465 (std) OK - PASSWORD WORKS');
        } catch (e2) {
            console.log('❌ 465 (std) FAIL:', e2.message);
        }
    }
}

test();

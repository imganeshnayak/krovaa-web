import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import PDFDocument from 'pdfkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendEnvPath = path.join(__dirname, '..', '.env');
const rootEnvPath = path.join(__dirname, '..', '..', '.env');
const envPathToUse = fs.existsSync(backendEnvPath) ? backendEnvPath : rootEnvPath;
dotenv.config({ path: envPathToUse });

const smtpPort = Number.parseInt(process.env.EMAIL_PORT || '465', 10);
const smtpSecure = process.env.EMAIL_SECURE
  ? process.env.EMAIL_SECURE.toLowerCase() === 'true'
  : smtpPort === 465;

const isConfigured = process.env.EMAIL_USER && process.env.EMAIL_USER !== 'your_email@zoho.com';

let transporter;

if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtppro.zoho.in',
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: Number.parseInt(process.env.EMAIL_CONNECTION_TIMEOUT || '20000', 10),
    greetingTimeout: Number.parseInt(process.env.EMAIL_GREETING_TIMEOUT || '20000', 10),
    socketTimeout: Number.parseInt(process.env.EMAIL_SOCKET_TIMEOUT || '30000', 10),
    tls: {
      rejectUnauthorized: false // Helps with some VPS networking issues
    }
  });

  transporter.verify((err) => {
    if (err) {
      console.error('Email service error:', err.message);
    } else {
      console.log('Email service ready:', process.env.EMAIL_USER);
    }
  });
} else {
  console.log('⚠️ Email service not configured (using placeholders). Emails will be logged to console instead of sending.');
  transporter = {
    sendMail: async (options) => {
      console.log('\n================ MOCK EMAIL ================');
      console.log('To:', options.to);
      console.log('Subject:', options.subject);
      console.log('Text Content:\n', options.text);
      console.log('============================================\n');
    }
  };
}

export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/* ── Shared base layout ── */
const emailShell = (accentColor, headerLabel, bodyHtml) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Krovaa</title>
</head>
<body style="margin:0;padding:0;background:#030508;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#030508;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Wordmark header -->
          <tr>
            <td style="padding-bottom:28px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-block;background:${accentColor};width:28px;height:28px;border-radius:8px;vertical-align:middle;margin-right:10px;"></div>
                  </td>
                  <td>
                    <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;vertical-align:middle;">Krovaa</span>
                  </td>
                </tr>
              </table>
              <p style="color:rgba(255,255,255,0.2);font-size:11px;margin:6px 0 0;letter-spacing:0.18em;text-transform:uppercase;">${headerLabel}</p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#0b0f1a;border-radius:20px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">

              <!-- Top accent bar -->
              <div style="height:2px;background:linear-gradient(90deg,transparent,${accentColor},transparent);"></div>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:40px 40px 32px;">
                    ${bodyHtml}
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);" align="center">
                    <p style="color:rgba(255,255,255,0.12);font-size:11px;margin:0;letter-spacing:0.06em;">
                      &copy; 2026 Krovaa &nbsp;&middot;&nbsp; support@krovaa.com
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/* ── OTP code block ── */
const otpBlock = (otp, accent, expiry = '10 minutes') => `
  <div style="background:#060a12;border-radius:14px;border:1px solid rgba(255,255,255,0.06);padding:28px 24px;text-align:center;margin:28px 0;">
    <p style="color:rgba(255,255,255,0.2);font-size:10px;margin:0 0 14px;letter-spacing:0.22em;text-transform:uppercase;">Verification Code</p>
    <p style="color:${accent};font-size:44px;font-weight:800;margin:0;letter-spacing:14px;font-family:'Courier New',Courier,monospace;line-height:1;">${otp}</p>
    <p style="color:rgba(255,255,255,0.18);font-size:11px;margin:14px 0 0;letter-spacing:0.06em;">Expires in ${expiry}</p>
  </div>`;

/* ── Registration OTP ── */
export async function sendRegistrationOtp(email, otp) {
  const subject = `Your Krovaa verification code`;
  const text = `Hello,

Your Krovaa verification code is:

${otp}

This code expires in 10 minutes.

If you did not request this code, you can ignore this email.

— Krovaa Security
https://krovaa.com`;

  const html = `
    <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
      <p>Hello,</p>
      <p>Your Krovaa verification code is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">${otp}</p>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request this code, you can ignore this email.</p>
      <p style="margin-top: 30px;">
        — Krovaa Security<br>
        <a href="https://krovaa.com" style="color: #3b82f6; text-decoration: none;">https://krovaa.com</a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Krovaa Security" <${process.env.EMAIL_USER || 'noreply@krovaa.com'}>`,
    to: email,
    replyTo: 'support@krovaa.com',
    subject,
    text,
    html,
  });

  console.log(`Registration OTP sent to ${email}`);
}

/* ── Password reset OTP ── */
export async function sendPasswordResetOtp(email, otp) {
  const subject = `Your Krovaa password reset code`;
  const text = `Hello,

Your Krovaa password reset code is:

${otp}

This code expires in 10 minutes.

If you did not request this code, you can ignore this email.

— Krovaa Security
https://krovaa.com`;

  const html = `
    <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
      <p>Hello,</p>
      <p>Your Krovaa password reset code is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">${otp}</p>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request this code, your account remains secure.</p>
      <p style="margin-top: 30px;">
        — Krovaa Security<br>
        <a href="https://krovaa.com" style="color: #3b82f6; text-decoration: none;">https://krovaa.com</a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Krovaa Security" <${process.env.EMAIL_USER || 'noreply@krovaa.com'}>`,
    to: email,
    replyTo: 'support@krovaa.com',
    subject,
    text,
    html,
  });

  console.log(`Password reset OTP sent to ${email}`);
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatCurrency = (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency,
  maximumFractionDigits: Number.isInteger(Number(amount || 0)) ? 0 : 2,
}).format(Number(amount || 0));

function buildReceiptPdf(details) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const accent = '#D946EF';
    const dark = '#111827';
    const muted = '#6B7280';
    const border = '#E5E7EB';
    const light = '#F9FAFB';

    doc.rect(0, 0, doc.page.width, 18).fill(accent);
    doc.moveDown(2);
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(22).text('Krovaa Subscription Receipt', { align: 'center' });
    doc.moveDown(0.6);
    doc.fillColor(muted).font('Helvetica').fontSize(10).text('This PDF confirms your subscription purchase and plan activation.', { align: 'center' });

    const summaryTop = 140;
    doc.roundedRect(48, summaryTop, doc.page.width - 96, 92, 12).lineWidth(1).strokeColor(border).stroke();
    doc.fillColor(muted).font('Helvetica').fontSize(10).text('Customer', 64, summaryTop + 16);
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(12).text(details.customerName || 'Krovaa member', 64, summaryTop + 32);
    doc.fillColor(muted).font('Helvetica').fontSize(10).text(details.email || '-', 64, summaryTop + 50);

    doc.fillColor(muted).font('Helvetica').fontSize(10).text('Receipt ID', 330, summaryTop + 16);
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(12).text(details.receiptReference || '-', 330, summaryTop + 32);
    doc.fillColor(muted).font('Helvetica').fontSize(10).text(`Issued ${new Date(details.issuedAt || Date.now()).toLocaleString()}`, 330, summaryTop + 50);

    const rows = [
      ['Plan', details.planName || '-'],
      ['Billing cycle', details.billingCycle || '-'],
      ['Amount paid', formatCurrency(details.amount, details.currency)],
      ['Payment status', details.status || 'PAID'],
      ['Monthly limit', details.monthlyLimit == null ? '-' : String(details.monthlyLimit)],
      ['Activated on', new Date(details.issuedAt || Date.now()).toLocaleString()],
      ['Valid until', details.expiresAt ? new Date(details.expiresAt).toLocaleDateString() : '-'],
      ['Payment reference', details.paymentReference || '-'],
      ['Payment method', details.paymentMethod || 'Razorpay'],
    ];

    const rowStart = summaryTop + 122;
    rows.forEach(([label, value], index) => {
      const rowY = rowStart + (index * 30);
      doc.roundedRect(48, rowY, doc.page.width - 96, 24, 8).fillAndStroke(light, border);
      doc.fillColor(muted).font('Helvetica').fontSize(10).text(label, 64, rowY + 8);
      doc.fillColor(dark).font('Helvetica-Bold').fontSize(10).text(String(value), 260, rowY + 8, {
        width: doc.page.width - 324,
        align: 'right'
      });
    });

    const footerTop = rowStart + (rows.length * 30) + 28;
    doc.fillColor(muted).font('Helvetica').fontSize(10).text('Keep this receipt for your records. Contact support@krovaa.com if you need any billing help.', 48, footerTop, { width: doc.page.width - 96, align: 'center' });

    doc.end();
  });
}

export async function sendSubscriptionReceiptEmail(email, details) {
  const customerName = details.customerName || 'Krovaa member';
  const receiptReference = details.receiptReference || `receipt_${Date.now()}`;
  const amountLabel = formatCurrency(details.amount, details.currency);
  const senderEmail = process.env.EMAIL_USER || 'support@krovaa.com';
  const pdfBuffer = await buildReceiptPdf({
    ...details,
    email,
    receiptReference,
  });

  const subject = `Your Krovaa Payment Receipt (PDF)`;
  const cycleText = details.billingCycle ? ` • ${details.billingCycle}` : '';
  const bodyHtml = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#E5E7EB;line-height:1.6;">
      <p style="margin:0 0 12px;">Hi ${escapeHtml(customerName)},</p>
      <p style="margin:0 0 18px;">Your payment was successful. Your paid receipt PDF is attached to this email.</p>
      <div style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:18px 20px;margin:0 0 18px;">
        <p style="margin:0 0 8px;color:#9CA3AF;font-size:12px;text-transform:uppercase;letter-spacing:.12em;">Payment receipt summary</p>
        <p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:700;">${escapeHtml(details.planName || 'Subscription')}</p>
        <p style="margin:4px 0 0;color:#D946EF;font-size:14px;font-weight:700;">${escapeHtml(amountLabel + cycleText)}</p>
      </div>
      <p style="margin:0;color:#9CA3AF;font-size:13px;">Receipt ID: ${escapeHtml(receiptReference)}</p>
      <p style="margin:4px 0 0;color:#9CA3AF;font-size:13px;">Payment Status: ${escapeHtml(details.status || 'PAID')}</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Krovaa Billing" <${process.env.EMAIL_USER || senderEmail}>`,
    to: email,
    replyTo: 'support@krovaa.com',
    subject,
    text: `Hi ${customerName},\n\nYour payment was successful. Receipt ID: ${receiptReference}. Amount Paid: ${amountLabel}. Status: ${details.status || 'PAID'}.\n\nThe paid receipt PDF is attached to this email.`,
    html: emailShell('#D946EF', 'Subscription Receipt', bodyHtml),
    attachments: [{
      filename: `Krovaa-Subscription-Receipt-${receiptReference}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  });

  console.log(`Subscription receipt sent to ${email}`);
}
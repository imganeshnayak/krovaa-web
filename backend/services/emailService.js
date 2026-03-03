import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtppro.zoho.in',
  port: parseInt(process.env.EMAIL_PORT) || 465,
  secure: (process.env.EMAIL_PORT === '465' || !process.env.EMAIL_PORT), // Default to secure if port is 465 or empty
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
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
  const accent = '#3b82f6';

  const body = `
    <h2 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 10px;letter-spacing:-0.3px;">Verify your email address</h2>
    <p style="color:rgba(255,255,255,0.35);font-size:14px;line-height:1.7;margin:0;">
      Someone used this email to create a Krovaa account. Enter the code below to confirm it's you.
    </p>

    ${otpBlock(otp, accent)}

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:16px;background:#060a12;border-radius:12px;border:1px solid rgba(255,255,255,0.05);">
          <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;line-height:1.6;">
            Do not share this code with anyone. Krovaa will never ask for it over chat or phone.
            If you did not create an account, you can safely ignore this email.
          </p>
        </td>
      </tr>
    </table>`;

  const html = emailShell(accent, 'Email Verification', body);

  await transporter.sendMail({
    from: `"Krovaa" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${otp} — your Krovaa verification code`,
    html,
  });

  console.log(`Registration OTP sent to ${email}`);
}

/* ── Password reset OTP ── */
export async function sendPasswordResetOtp(email, otp) {
  const accent = '#ef4444';

  const body = `
    <h2 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 10px;letter-spacing:-0.3px;">Reset your password</h2>
    <p style="color:rgba(255,255,255,0.35);font-size:14px;line-height:1.7;margin:0;">
      We received a request to reset the password for the Krovaa account associated with this email.
      Use the code below to proceed.
    </p>

    ${otpBlock(otp, accent)}

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:16px;background:#060a12;border-radius:12px;border:1px solid rgba(255,255,255,0.05);">
          <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;line-height:1.6;">
            If you did not request a password reset, your account remains secure — no action is needed.
            Never share this code with anyone.
          </p>
        </td>
      </tr>
    </table>`;

  const html = emailShell(accent, 'Password Reset', body);

  await transporter.sendMail({
    from: `"Krovaa" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${otp} — your Krovaa password reset code`,
    html,
  });

  console.log(`Password reset OTP sent to ${email}`);
}
import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

interface SendOtpResult {
  success: boolean;
  delivered: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

let transporter: Transporter | null = null;

export function getEmailTransporter(): Transporter | null {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  const rawPass = process.env.SMTP_PASS?.trim();

  if (!host || !user || !rawPass || user.includes('YOUR_') || rawPass.includes('YOUR_')) {
    return null;
  }

  const pass = rawPass.replace(/\s+/g, '');

  const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });

  return transporter;
}

export async function testSmtpConnection(): Promise<boolean> {
  if (process.env.RESEND_API_KEY) {
    console.log('[EMAIL] ✓ Active Resend HTTP API (Port 443 HTTPS - bypasses Render port blocks)');
    return true;
  }

  if (process.env.BREVO_API_KEY) {
    console.log('[EMAIL] ✓ Active Brevo HTTP API (Port 443 HTTPS - bypasses Render port blocks)');
    return true;
  }

  const mailer = getEmailTransporter();
  if (!mailer) {
    console.log('[SMTP] No email credentials provided in .env (operating in console fallback mode).');
    return false;
  }

  try {
    await mailer.verify();
    console.log(`[SMTP] ✓ Successfully connected to SMTP server (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587})`);
    return true;
  } catch (error: any) {
    console.warn(`[SMTP] Notice: Direct SMTP connection timed out or blocked (${error.message}). Will use console OTP fallback if needed.`);
    return false;
  }
}

async function sendViaResend(
  apiKey: string,
  toEmail: string,
  otp: string,
  htmlContent: string
): Promise<SendOtpResult> {
  const from = process.env.RESEND_FROM || 'Organova <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject: 'Verify your Organova account',
        html: htmlContent,
      }),
    });

    const data: any = await res.json();
    if (res.ok) {
      console.log(`[RESEND-API] ✓ Email dispatched via HTTPS to ${toEmail} (ID: ${data.id})`);
      return { success: true, delivered: true, messageId: data.id };
    } else {
      throw new Error(data.message || 'Resend API returned error');
    }
  } catch (err: any) {
    console.error(`[RESEND-API] Failed to dispatch email to ${toEmail}:`, err.message);
    return { success: false, delivered: false, error: err.message };
  }
}

async function sendViaBrevo(
  apiKey: string,
  toEmail: string,
  otp: string,
  htmlContent: string
): Promise<SendOtpResult> {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'no-reply@organova.org';
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Organova Platform', email: senderEmail },
        to: [{ email: toEmail }],
        subject: 'Verify your Organova account',
        htmlContent: htmlContent,
      }),
    });

    const data: any = await res.json();
    if (res.ok) {
      console.log(`[BREVO-API] ✓ Email dispatched via HTTPS to ${toEmail} (MessageId: ${data.messageId})`);
      return { success: true, delivered: true, messageId: data.messageId };
    } else {
      throw new Error(data.message || 'Brevo API returned error');
    }
  } catch (err: any) {
    console.error(`[BREVO-API] Failed to dispatch email to ${toEmail}:`, err.message);
    return { success: false, delivered: false, error: err.message };
  }
}

export async function sendOtpEmail(toEmail: string, otp: string): Promise<SendOtpResult> {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Organova Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 36px 40px 24px 40px; text-align: center; border-bottom: 1px solid #f1f5f9; background: #ffffff;">
              <div style="display: inline-block; padding: 12px 14px; border-radius: 16px; background-color: #ffe4e6; margin-bottom: 12px;">
                <span style="font-size: 28px; line-height: 1;">🫀</span>
              </div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a;">
                ORGA<span style="color: #e11d48;">NOVA</span>
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">
                Organ & Blood Network
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 40px;">
              <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0f172a; text-align: center;">
                Verify Your Account
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569; text-align: center;">
                Thank you for joining the Organova Network. Use the 6-digit one-time verification code below to complete your registration and activate your account.
              </p>

              <!-- OTP Code Display Badge -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 18px 36px; background-color: #fff1f2; border: 2px dashed #f43f5e; border-radius: 16px;">
                      <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #be123c; font-family: 'Courier New', Courier, monospace; display: block;">
                        ${otp}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 13px; text-align: center; color: #e11d48; font-weight: 600;">
                ⏱ This verification code is valid for 5 minutes.
              </p>

              <!-- Security Notice Callout -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #e11d48; border-radius: 10px; padding: 14px 18px; margin: 24px 0 0 0;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #475569;">
                  <strong style="color: #0f172a;">Security Tip:</strong> Never share this verification code with anyone. This single-use code is private and expires in 5 minutes.
                </p>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 12px; line-height: 1.5; color: #94a3b8; text-align: center;">
                If you did not initiate this request, you can safely ignore this email. No changes will be made to your email or account.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #475569;">
                Organova Platform
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                © ${new Date().getFullYear()} Organova Platform. Empowering Lifesaving Logistics.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  if (process.env.RESEND_API_KEY) {
    const resendResult = await sendViaResend(process.env.RESEND_API_KEY, toEmail, otp, htmlContent);
    if (resendResult.success) return resendResult;
  }

  if (process.env.BREVO_API_KEY) {
    const brevoResult = await sendViaBrevo(process.env.BREVO_API_KEY, toEmail, otp, htmlContent);
    if (brevoResult.success) return brevoResult;
  }

  const mailer = getEmailTransporter();
  const fromAddress = process.env.SMTP_FROM || `"Organova" <${process.env.SMTP_USER || 'no-reply@organova.local'}>`;

  if (mailer) {
    try {
      const info = await mailer.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: 'Verify your Organova account',
        text: `Welcome to Organova. Your one-time verification code is: ${otp}. This code is valid for 5 minutes. If you did not request this, please ignore this email.`,
        html: htmlContent,
      });

      console.log(`[SMTP] ✓ OTP verification email dispatched to ${toEmail} (Message ID: ${info.messageId})`);
      return { success: true, delivered: true, messageId: info.messageId };
    } catch (error: any) {
      console.warn(`[SMTP] Notice: Email delivery failed via SMTP (${error.message}).`);
    }
  }

  console.log('----------------------------------------------------');
  console.log(`[AUTH-OTP-FALLBACK] Candidate: ${toEmail} | Verification Code: ${otp}`);
  console.log('----------------------------------------------------');

  return {
    success: true,
    delivered: false,
    messageId: 'console-otp-fallback',
  };
}

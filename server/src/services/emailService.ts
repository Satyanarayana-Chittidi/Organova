import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

interface SendOtpResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

let transporter: Transporter | null = null;

/**
 * Initializes and returns the active Nodemailer transporter.
 * If SMTP credentials are not configured, returns null to signal fallback to console logging.
 */
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

  // Strip spaces if user pasted Google 4-block app password format ("abcd efgh ijkl mnop")
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
  });

  return transporter;
}

/**
 * Verifies the SMTP transporter connectivity.
 */
export async function testSmtpConnection(): Promise<boolean> {
  const mailer = getEmailTransporter();
  if (!mailer) {
    console.log('[SMTP] No SMTP credentials provided in .env (operating in console fallback mode).');
    return false;
  }

  try {
    await mailer.verify();
    console.log(`[SMTP] ✓ Successfully connected to SMTP server (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587})`);
    return true;
  } catch (error: any) {
    console.error('[SMTP] Connection failed:', error.message);
    return false;
  }
}

/**
 * Sends a 6-digit OTP verification email to the user.
 */
export async function sendOtpEmail(toEmail: string, otp: string): Promise<SendOtpResult> {
  const mailer = getEmailTransporter();
  const fromAddress = process.env.SMTP_FROM || `"Organova Health Network" <${process.env.SMTP_USER || 'no-reply@organova.local'}>`;

  // Fallback: If no SMTP credentials are set, log OTP to console
  if (!mailer) {
    console.log('----------------------------------------------------');
    console.log(`[SMTP-FALLBACK] OTP for ${toEmail}: ${otp}`);
    console.log('[SMTP-FALLBACK] (Configure SMTP_HOST, SMTP_USER, SMTP_PASS in .env to deliver real emails)');
    console.log('----------------------------------------------------');
    return {
      success: true,
      messageId: 'dev-console-fallback',
    };
  }

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

  try {
    const info = await mailer.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: 'Verify your Organova account',
      text: `Welcome to Organova. Your one-time verification code is: ${otp}. This code is valid for 5 minutes. If you did not request this, please ignore this email.`,
      html: htmlContent,
    });

    console.log(`[SMTP] ✓ OTP verification email dispatched to ${toEmail} (Message ID: ${info.messageId})`);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[SMTP] Ethereal Preview URL: ${previewUrl}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
    };
  } catch (error: any) {
    console.error(`[SMTP] Failed to send email to ${toEmail}:`, error.message);
    // Even if email delivery fails, keep OTP logged to console as fallback for developer resilience
    console.log(`[SMTP-FALLBACK] OTP for ${toEmail}: ${otp}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

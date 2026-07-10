/**
 * Pluggable email service.
 * Defaults to console logging. If RESEND_API_KEY or SENDGRID_API_KEY
 * is set in .env, it would use that provider instead.
 *
 * For now, all emails are logged to console — fully functional flow
 * without requiring external API keys.
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// FRONTEND_URL may be a comma-separated list of allowed origins;
// email links always point at the first (primary) URL.
const getFrontendUrl = (): string =>
  (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

class EmailService {
  private provider: 'console' | 'resend' | 'sendgrid';

  constructor() {
    if (process.env.RESEND_API_KEY) {
      this.provider = 'resend';
    } else if (process.env.SENDGRID_API_KEY) {
      this.provider = 'sendgrid';
    } else {
      this.provider = 'console';
    }

    console.log(`📧 Email service initialized: provider=${this.provider}`);
  }

  async send(options: EmailOptions): Promise<boolean> {
    switch (this.provider) {
      case 'console':
        return this.sendViaConsole(options);
      case 'resend':
        return this.sendViaResend(options);
      case 'sendgrid':
        return this.sendViaSendGrid(options);
      default:
        return this.sendViaConsole(options);
    }
  }

  private async sendViaConsole(options: EmailOptions): Promise<boolean> {
    console.log('\n' + '='.repeat(60));
    console.log('📧 EMAIL (console provider — no real email sent)');
    console.log('='.repeat(60));
    console.log(`To:      ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log('-'.repeat(60));
    console.log(options.text || options.html);
    console.log('='.repeat(60) + '\n');
    return true;
  }

  private async sendViaResend(_options: EmailOptions): Promise<boolean> {
    // TODO: Implement Resend API integration
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({ from: '...', ...options });
    console.log('Resend provider not yet implemented, falling back to console');
    return this.sendViaConsole(_options);
  }

  private async sendViaSendGrid(_options: EmailOptions): Promise<boolean> {
    // TODO: Implement SendGrid API integration
    console.log('SendGrid provider not yet implemented, falling back to console');
    return this.sendViaConsole(_options);
  }

  // --- Convenience methods for common email types ---

  async sendVerificationEmail(to: string, token: string): Promise<boolean> {
    const frontendUrl = getFrontendUrl();
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

    return this.send({
      to,
      subject: 'Verify your email — Rotaract SLIIT Portal',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #9e1b32;">Welcome to RACSLIIT Portal!</h2>
          <p>Please verify your email address by clicking the link below:</p>
          <p><a href="${verifyUrl}" style="display: inline-block; background: #9e1b32; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Verify Email</a></p>
          <p style="color: #666; font-size: 14px;">Or copy this link: ${verifyUrl}</p>
          <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
        </div>
      `,
      text: `Verify your email: ${verifyUrl}`,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
    const frontendUrl = getFrontendUrl();
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    return this.send({
      to,
      subject: 'Reset your password — Rotaract SLIIT Portal',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #9e1b32;">Password Reset Request</h2>
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <p><a href="${resetUrl}" style="display: inline-block; background: #9e1b32; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Reset Password</a></p>
          <p style="color: #666; font-size: 14px;">Or copy this link: ${resetUrl}</p>
          <p style="color: #999; font-size: 12px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
        </div>
      `,
      text: `Reset your password: ${resetUrl}`,
    });
  }

  async sendApprovalNotification(to: string, firstName: string): Promise<boolean> {
    return this.send({
      to,
      subject: 'Your membership has been approved — Rotaract SLIIT Portal',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #9e1b32;">Welcome aboard, ${firstName}! 🎉</h2>
          <p>Your membership in the Rotaract Club of SLIIT has been approved. You can now log in and access the portal.</p>
          <p><a href="${getFrontendUrl()}/login" style="display: inline-block; background: #9e1b32; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Login Now</a></p>
        </div>
      `,
      text: `Welcome aboard, ${firstName}! Your membership has been approved. Login at ${getFrontendUrl()}/login`,
    });
  }

  async sendRejectionNotification(to: string, firstName: string): Promise<boolean> {
    return this.send({
      to,
      subject: 'Membership update — Rotaract SLIIT Portal',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #9e1b32;">Membership Update</h2>
          <p>Hi ${firstName}, unfortunately your membership application was not approved at this time.</p>
          <p>If you believe this is an error, please contact the Membership Director.</p>
        </div>
      `,
      text: `Hi ${firstName}, unfortunately your membership application was not approved at this time.`,
    });
  }
}

// Singleton instance
const emailService = new EmailService();
export default emailService;

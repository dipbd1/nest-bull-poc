import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { AuthConfig } from '../config/auth.config.js';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly auth: AuthConfig;

  constructor(configService: ConfigService) {
    this.auth = configService.getOrThrow<AuthConfig>('auth');
    this.transporter = nodemailer.createTransport({
      host: this.auth.smtp.host,
      port: this.auth.smtp.port,
      secure: false,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
    });
  }

  async sendRegistrationCode(email: string, code: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.auth.mailFrom,
        to: email,
        subject: 'Your registration code',
        text: `Your registration code is ${code}. It expires in 10 minutes.`,
      });
    } catch {
      throw new ServiceUnavailableException(
        'Failed to send registration email',
      );
    }
  }

  async sendInvite(email: string, link: string, expiresAt: Date): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.auth.mailFrom,
        to: email,
        subject: 'You are invited to the feedback coder',
        text: `Open this link to set your password: ${link}\n\nThe link expires at ${expiresAt.toISOString()}.`,
      });
    } catch {
      throw new ServiceUnavailableException('Failed to send invitation email');
    }
  }

  /** Opens an SMTP connection and greets the server. Sends nothing. */
  verify(): Promise<true> {
    return this.transporter.verify();
  }
}

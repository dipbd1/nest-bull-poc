import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { AuditService, type AuditActor } from '../audit/audit.service.js';
import { hashPassword, normalizeEmail } from '../auth/auth.crypto.js';
import { AuthService } from '../auth/auth.service.js';
import { User, type UserRole } from '../auth/entities/user.entity.js';
import { MailService } from '../auth/mail.service.js';
import type { AppConfig } from '../config/app.config.js';
import { AcceptInviteDto } from './dto/accept-invite.dto.js';
import { CreateInviteDto } from './dto/create-invite.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Invite } from './entities/invite.entity.js';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITE_ACCEPT_PATH = '/invite';
const INVALID_INVITE_MESSAGE = 'Invalid or expired invitation';

export type UserView = {
  id: string;
  email: string;
  role: UserRole;
  disabledAt: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
};

export type InviteView = {
  id: string;
  email: string;
  role: UserRole;
  expiresAt: string;
  invitedById: string | null;
  createdAt: string;
};

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toUserView(user: User): UserView {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    disabledAt: user.disabledAt?.toISOString() ?? null,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function toInviteView(invite: Invite): InviteView {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
    invitedById: invite.invitedById,
    createdAt: invite.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Invite)
    private readonly invites: Repository<Invite>,
    private readonly auth: AuthService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async list(): Promise<UserView[]> {
    const users = await this.users.find({ order: { createdAt: 'ASC' } });
    return users.map(toUserView);
  }

  async listPendingInvites(): Promise<InviteView[]> {
    const invites = await this.invites.find({
      where: { acceptedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    return invites.map(toInviteView);
  }

  async invite(dto: CreateInviteDto, actor: AuditActor): Promise<InviteView> {
    const email = normalizeEmail(dto.email);
    const existing = await this.users.findOne({ where: { email } });
    if (existing && !existing.disabledAt) {
      throw new ConflictException('This person already has an account');
    }

    await this.invites.delete({ email, acceptedAt: IsNull() });

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const invite = await this.invites.save(
      this.invites.create({
        email,
        role: dto.role,
        tokenHash: hashInviteToken(token),
        expiresAt,
        invitedById: actor?.id ?? null,
        acceptedAt: null,
      }),
    );

    const { webOrigin } = this.config.getOrThrow<AppConfig>('app');
    const link = `${webOrigin}${INVITE_ACCEPT_PATH}?token=${encodeURIComponent(token)}`;
    try {
      await this.mail.sendInvite(email, link, expiresAt);
    } catch (error) {
      await this.invites.delete({ id: invite.id });
      throw error;
    }

    await this.audit.record({
      actor,
      action: 'user.invite',
      targetType: 'invite',
      targetId: invite.id,
      metadata: { email, role: dto.role },
    });
    return toInviteView(invite);
  }

  async acceptInvite(dto: AcceptInviteDto): Promise<{ accessToken: string }> {
    const invite = await this.invites.findOne({
      where: { tokenHash: hashInviteToken(dto.token) },
    });
    if (
      !invite ||
      invite.acceptedAt ||
      invite.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException(INVALID_INVITE_MESSAGE);
    }

    const claimed = await this.invites.update(
      { id: invite.id, acceptedAt: IsNull() },
      { acceptedAt: new Date() },
    );
    if (!claimed.affected) {
      throw new BadRequestException(INVALID_INVITE_MESSAGE);
    }

    const passwordHash = await hashPassword(dto.password);
    const existing = await this.users.findOne({
      where: { email: invite.email },
    });
    let user: User;
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.role = invite.role;
      existing.disabledAt = null;
      existing.emailVerifiedAt ??= new Date();
      existing.sessionVersion += 1;
      user = await this.users.save(existing);
    } else {
      user = await this.users.save(
        this.users.create({
          email: invite.email,
          passwordHash,
          role: invite.role,
          emailVerifiedAt: new Date(),
        }),
      );
    }

    await this.audit.record({
      actor: { id: user.id, email: user.email },
      action: 'user.invite_accept',
      targetType: 'user',
      targetId: user.id,
      metadata: { role: user.role },
    });
    return { accessToken: await this.auth.issueToken(user) };
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: AuditActor,
  ): Promise<UserView> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const disabling = dto.disabled === true && !user.disabledAt;
    const enabling = dto.disabled === false && Boolean(user.disabledAt);
    const roleChange =
      dto.role !== undefined && dto.role !== user.role ? dto.role : undefined;
    const losesAdmin =
      user.role === 'admin' &&
      !user.disabledAt &&
      (disabling || roleChange === 'reviewer');

    if (losesAdmin && actor?.id === user.id) {
      throw new BadRequestException('You cannot disable or demote yourself');
    }
    if (losesAdmin) {
      const activeAdmins = await this.users.count({
        where: { role: 'admin', disabledAt: IsNull() },
      });
      if (activeAdmins <= 1) {
        throw new BadRequestException('At least one active admin is required');
      }
    }

    const previousRole = user.role;
    if (disabling) {
      user.disabledAt = new Date();
      user.sessionVersion += 1;
    }
    if (enabling) {
      user.disabledAt = null;
    }
    if (roleChange) {
      user.role = roleChange;
    }
    if (!disabling && !enabling && !roleChange) {
      return toUserView(user);
    }

    const saved = await this.users.save(user);
    if (disabling || enabling) {
      await this.audit.record({
        actor,
        action: disabling ? 'user.disable' : 'user.enable',
        targetType: 'user',
        targetId: user.id,
        metadata: { email: user.email },
      });
    }
    if (roleChange) {
      await this.audit.record({
        actor,
        action: 'user.role',
        targetType: 'user',
        targetId: user.id,
        metadata: { email: user.email, from: previousRole, to: roleChange },
      });
    }
    return toUserView(saved);
  }
}

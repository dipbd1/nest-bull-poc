import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import { User } from '../auth/entities/user.entity.js';
import { MailService } from '../auth/mail.service.js';
import { Invite } from './entities/invite.entity.js';
import { hashInviteToken, UsersService } from './users.service.js';

const admin = { id: 'admin-1', email: 'admin@example.com' };

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'rev@example.com',
    passwordHash: 'x:y',
    emailVerifiedAt: new Date(),
    role: 'reviewer',
    disabledAt: null,
    sessionVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    registrationCodes: [],
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  const users = {
    find: vi.fn(),
    findOne: vi.fn(),
    save: vi.fn(async (user: User) => user),
    create: vi.fn((user: Partial<User>) => ({ sessionVersion: 1, ...user })),
    count: vi.fn(),
  };
  const invites = {
    find: vi.fn(),
    findOne: vi.fn(),
    save: vi.fn(async (invite: Invite) => ({
      ...invite,
      id: 'invite-1',
      createdAt: new Date(),
    })),
    create: vi.fn((invite: Partial<Invite>) => invite),
    delete: vi.fn(),
    update: vi.fn(),
  };
  const auth = { issueToken: vi.fn().mockResolvedValue('token') };
  const mail = { sendInvite: vi.fn() };
  const audit = { record: vi.fn() };
  const config = {
    getOrThrow: vi.fn(() => ({ webOrigin: 'https://coder.example.com' })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Invite), useValue: invites },
        { provide: AuthService, useValue: auth },
        { provide: MailService, useValue: mail },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('stores only a hash of the invite token and mails the link', async () => {
    users.findOne.mockResolvedValue(null);

    await service.invite({ email: 'New@Example.com', role: 'reviewer' }, admin);

    const link = mail.sendInvite.mock.calls[0][1] as string;
    const token = new URL(link).searchParams.get('token') ?? '';
    expect(link.startsWith('https://coder.example.com/invite?token=')).toBe(true);
    const saved = invites.save.mock.calls[0][0] as Invite;
    expect(saved.tokenHash).toBe(hashInviteToken(token));
    expect(JSON.stringify(saved)).not.toContain(token);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.invite',
        metadata: { email: 'new@example.com', role: 'reviewer' },
      }),
    );
  });

  it('refuses to invite an active account', async () => {
    users.findOne.mockResolvedValue(makeUser());
    await expect(
      service.invite({ email: 'rev@example.com', role: 'reviewer' }, admin),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepts an invite once, setting password and role', async () => {
    invites.findOne.mockResolvedValue({
      id: 'invite-1',
      email: 'new@example.com',
      role: 'admin',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    invites.update.mockResolvedValue({ affected: 1 });
    users.findOne.mockResolvedValue(null);

    await expect(
      service.acceptInvite({ token: 't'.repeat(43), password: 'password1' }),
    ).resolves.toEqual({ accessToken: 'token' });
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', role: 'admin' }),
    );

    invites.update.mockResolvedValue({ affected: 0 });
    await expect(
      service.acceptInvite({ token: 't'.repeat(43), password: 'password1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('disabling a user bumps the session version and audits', async () => {
    const user = makeUser();
    users.findOne.mockResolvedValue(user);

    const view = await service.update('user-1', { disabled: true }, admin);

    expect(view.disabledAt).not.toBeNull();
    expect(user.sessionVersion).toBe(2);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.disable', targetId: 'user-1' }),
    );
  });

  it('keeps at least one active admin', async () => {
    users.findOne.mockResolvedValue(makeUser({ id: 'admin-2', role: 'admin' }));
    users.count.mockResolvedValue(1);

    await expect(
      service.update('admin-2', { role: 'reviewer' }, admin),
    ).rejects.toThrow('At least one active admin is required');
  });

  it('does not let an admin disable themselves', async () => {
    users.findOne.mockResolvedValue(makeUser({ id: 'admin-1', role: 'admin' }));
    await expect(
      service.update('admin-1', { disabled: true }, admin),
    ).rejects.toThrow('You cannot disable or demote yourself');
  });
});

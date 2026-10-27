import { randomBytes } from 'node:crypto';
import type {
  InviteUserInput,
  ListManagedUsersQuery,
  ManagedUser,
  Paginated,
  Role,
  UpdateUserInput,
} from '@fieldmate/shared';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { createAuthRepository } from '../auth/auth.repository.js';
import type { AuthDeps } from '../auth/auth.service.js';
import { createUserCodeService } from '../auth/user-code.service.js';
import type { TaskWriter } from '../tasks/task.repository.js';
import {
  createAdminUserRepository,
  type ManagedUserRow,
  type UserCursor,
} from './admin-user.repository.js';

const SEPARATOR = '\u0000';

function encodeUserCursor(row: ManagedUserRow): string {
  return Buffer.from(`${row.name}${SEPARATOR}${row.id}`).toString('base64url');
}

function decodeUserCursor(value: string): UserCursor {
  const invalid = () => new AppError('INVALID_REQUEST', 'The page cursor is not valid.');
  const decoded = Buffer.from(value, 'base64url').toString('utf8');
  const separator = decoded.lastIndexOf(SEPARATOR);
  if (separator <= 0) throw invalid();

  const name = decoded.slice(0, separator);
  const id = decoded.slice(separator + 1);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw invalid();
  return { name, id };
}

const userNotFound = () => new AppError('USER_NOT_FOUND', 'User was not found.');

/** Who is inviting: managers may only bring in field workers. */
export type Inviter = { id: string; role: Role };

export function createAdminUserService(deps: AuthDeps) {
  const { db } = deps;
  const repository = createAdminUserRepository(db);
  const auth = createAuthRepository(db);
  const codes = createUserCodeService(deps);

  function toManagedUser(row: ManagedUserRow, hasHistory: boolean): ManagedUser {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      hasHistory,
      status: row.passwordSetAt ? 'ACTIVE' : 'INVITED',
    };
  }

  /** An inactive account cannot finish signing up or reset, so emailing it would only confuse. */
  function assertCanEmail(user: ManagedUserRow): void {
    if (!user.isActive) {
      throw new AppError('VALIDATION_ERROR', 'Reactivate this user before emailing them.');
    }
  }

  async function load(userId: string): Promise<ManagedUserRow> {
    const user = await repository.findById(userId);
    if (!user) throw userNotFound();
    return user;
  }

  /** An admin must not be able to lock themselves, or everyone, out (docs/07 §2). */
  function assertNotSelf(actorId: string, userId: string, what: string): void {
    if (actorId === userId) {
      throw new AppError('SELF_ACTION', `You cannot ${what} your own account.`);
    }
  }

  async function assertNotLastAdmin(tx: TaskWriter, user: ManagedUserRow): Promise<void> {
    if (user.role !== 'ADMIN' || !user.isActive) return;
    if ((await repository.lockActiveAdmins(tx)) <= 1) {
      throw new AppError('LAST_ADMIN', 'There must always be at least one active admin.');
    }
  }

  async function assertEmailFree(email: string, exceptUserId: string): Promise<void> {
    const existing = await repository.findByEmail(email);
    if (existing && existing.id !== exceptUserId) {
      throw new AppError('EMAIL_TAKEN', 'Another account already uses that email address.');
    }
  }

  return {
    async list(query: ListManagedUsersQuery): Promise<Paginated<ManagedUser>> {
      const cursor = query.cursor ? decodeUserCursor(query.cursor) : undefined;
      const rows = await repository.list({ ...query, limit: query.limit + 1 }, cursor);

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page.at(-1);

      return {
        // The list does not need per-user history; the detail screen asks for it.
        items: page.map((row) => toManagedUser(row, false)),
        nextCursor: hasMore && last ? encodeUserCursor(last) : null,
      };
    },

    async get(userId: string): Promise<ManagedUser> {
      const user = await load(userId);
      return toManagedUser(user, await repository.hasHistory(user.id));
    },

    /**
     * Creates the account as a pending invitation and emails the code the user
     * signs up with. Inviting an address that is still pending, for the same
     * role, sends a fresh code instead of failing. If the email cannot be sent
     * the account stays pending and the error says so; "Resend" retries.
     */
    async invite(inviter: Inviter, input: InviteUserInput): Promise<ManagedUser> {
      const role: Role = input.role ?? 'FIELD_WORKER';
      if (inviter.role !== 'ADMIN' && role !== 'FIELD_WORKER') {
        throw new AppError('FORBIDDEN', 'Managers can only invite field workers.');
      }

      const email = input.email.trim().toLowerCase();
      const existing = await repository.findByEmail(email);
      if (existing) {
        if (existing.passwordSetAt || existing.role !== role || !existing.isActive) {
          throw new AppError('EMAIL_TAKEN', 'Another account already uses that email address.');
        }
        await codes.sendInvite(existing);
        return toManagedUser(existing, false);
      }

      const user = await repository.create({
        name: input.name.trim(),
        email,
        role,
        // Never told to anyone: the account cannot be signed into until the
        // invitee sets their own password from the emailed code.
        passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
      });
      await codes.sendInvite(user);
      return toManagedUser(user, false);
    },

    async resendInvite(userId: string): Promise<void> {
      const user = await load(userId);
      if (user.passwordSetAt) {
        throw new AppError('ALREADY_ACTIVE', 'This user has already set up their account.');
      }
      assertCanEmail(user);
      await codes.sendInvite(user);
    },

    /** The admin never sees or chooses the password; the user picks it from the code. */
    async sendPasswordReset(userId: string): Promise<void> {
      const user = await load(userId);
      assertCanEmail(user);
      if (user.passwordSetAt) await codes.sendPasswordReset(user);
      else await codes.sendInvite(user);
    },

    async update(actorId: string, userId: string, input: UpdateUserInput): Promise<ManagedUser> {
      const user = await load(userId);

      let leavesAdmins = false;
      if (input.role !== undefined && input.role !== user.role) {
        assertNotSelf(actorId, userId, 'change the role of');
        leavesAdmins = true;
      }

      if (input.isActive === false && user.isActive) {
        assertNotSelf(actorId, userId, 'deactivate');
        leavesAdmins = true;
      }

      if (input.email !== undefined) {
        await assertEmailFree(input.email.trim().toLowerCase(), userId);
      }

      const fields = {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
        ...(input.role !== undefined ? { role: input.role as Role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      };

      const updated = await db.transaction(async (tx) => {
        if (leavesAdmins) await assertNotLastAdmin(tx, user);
        return repository.update(userId, fields, tx);
      });
      if (!updated) throw userNotFound();

      // Losing access or changing role ends existing sessions immediately.
      if (input.isActive === false || (input.role !== undefined && input.role !== user.role)) {
        await auth.revokeSessions(userId);
      }

      return toManagedUser(updated, await repository.hasHistory(userId));
    },

    async revokeSessions(userId: string): Promise<void> {
      await load(userId);
      await auth.revokeSessions(userId);
    },

    async remove(actorId: string, userId: string): Promise<void> {
      const user = await load(userId);
      assertNotSelf(actorId, userId, 'delete');

      if (await repository.hasHistory(userId)) {
        throw new AppError(
          'USER_HAS_HISTORY',
          'This user appears in task history, so they cannot be deleted. Deactivate them instead.',
        );
      }

      await db.transaction(async (tx) => {
        await assertNotLastAdmin(tx, user);
        await repository.delete(userId, tx);
      });
    },
  };
}

export type AdminUserService = ReturnType<typeof createAdminUserService>;

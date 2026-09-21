import type {
  CreateUserInput,
  ListManagedUsersQuery,
  ManagedUser,
  Paginated,
  Role,
  SetPasswordInput,
  UpdateUserInput,
} from '@fieldmate/shared';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { createAuthRepository } from '../auth/auth.repository.js';
import type { Database } from '../../db/client.js';
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

export function createAdminUserService(db: Database) {
  const repository = createAdminUserRepository(db);
  const auth = createAuthRepository(db);

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
    };
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

  async function assertNotLastAdmin(user: ManagedUserRow): Promise<void> {
    if (user.role !== 'ADMIN' || !user.isActive) return;
    if ((await repository.countActiveAdmins()) <= 1) {
      throw new AppError('LAST_ADMIN', 'There must always be at least one active admin.');
    }
  }

  async function assertEmailFree(email: string, exceptUserId?: string): Promise<void> {
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

    async create(input: CreateUserInput): Promise<ManagedUser> {
      const email = input.email.trim().toLowerCase();
      await assertEmailFree(email);

      const user = await repository.create({
        name: input.name.trim(),
        email,
        role: input.role as Role,
        passwordHash: await hashPassword(input.password),
      });
      return toManagedUser(user, false);
    },

    async update(actorId: string, userId: string, input: UpdateUserInput): Promise<ManagedUser> {
      const user = await load(userId);

      if (input.role !== undefined && input.role !== user.role) {
        assertNotSelf(actorId, userId, 'change the role of');
        if (user.role === 'ADMIN') await assertNotLastAdmin(user);
      }

      if (input.isActive === false && user.isActive) {
        assertNotSelf(actorId, userId, 'deactivate');
        await assertNotLastAdmin(user);
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

      const updated = await repository.update(userId, fields);
      if (!updated) throw userNotFound();

      // Losing access or changing role ends existing sessions immediately.
      if (input.isActive === false || (input.role !== undefined && input.role !== user.role)) {
        await auth.revokeSessions(userId);
      }

      return toManagedUser(updated, await repository.hasHistory(userId));
    },

    async setPassword(userId: string, input: SetPasswordInput): Promise<void> {
      await load(userId);
      await repository.setPassword(userId, await hashPassword(input.password));
    },

    async revokeSessions(userId: string): Promise<void> {
      await load(userId);
      await auth.revokeSessions(userId);
    },

    async remove(actorId: string, userId: string): Promise<void> {
      const user = await load(userId);
      assertNotSelf(actorId, userId, 'delete');
      await assertNotLastAdmin(user);

      if (await repository.hasHistory(userId)) {
        throw new AppError(
          'USER_HAS_HISTORY',
          'This user appears in task history, so they cannot be deleted. Deactivate them instead.',
        );
      }

      await repository.delete(userId);
    },
  };
}

export type AdminUserService = ReturnType<typeof createAdminUserService>;

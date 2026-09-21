import type {
  CreateUserInput,
  ManagedUser,
  Paginated,
  Role,
  UpdateUserInput,
} from '@fieldmate/shared';
import { apiRequest } from '../../services/http';

export type UserListQuery = {
  search?: string;
  role?: Role;
  isActive?: boolean;
  limit?: number;
  cursor?: string;
};

function usersPath({ search, role, isActive, limit, cursor }: UserListQuery): string {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (role) params.set('role', role);
  if (isActive !== undefined) params.set('isActive', String(isActive));
  if (limit) params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return query ? `/admin/users?${query}` : '/admin/users';
}

export function fetchUsers(query: UserListQuery = {}): Promise<Paginated<ManagedUser>> {
  return apiRequest<Paginated<ManagedUser>>(usersPath(query));
}

export function fetchUser(userId: string): Promise<ManagedUser> {
  return apiRequest<ManagedUser>(`/admin/users/${userId}`);
}

export function createUser(input: CreateUserInput): Promise<ManagedUser> {
  return apiRequest<ManagedUser>('/admin/users', { method: 'POST', body: input });
}

export function updateUser(userId: string, input: UpdateUserInput): Promise<ManagedUser> {
  return apiRequest<ManagedUser>(`/admin/users/${userId}`, { method: 'PATCH', body: input });
}

export function setUserPassword(userId: string, password: string): Promise<void> {
  return apiRequest<void>(`/admin/users/${userId}/password`, {
    method: 'POST',
    body: { password },
  });
}

export function revokeUserSessions(userId: string): Promise<void> {
  return apiRequest<void>(`/admin/users/${userId}/sessions/revoke`, { method: 'POST' });
}

export function deleteUser(userId: string): Promise<void> {
  return apiRequest<void>(`/admin/users/${userId}`, { method: 'DELETE' });
}

import type { LoginResponse, User } from '@fieldmate/shared';
import { apiRequest } from '../../services/http';

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function getCurrentUser(): Promise<User> {
  return apiRequest<User>('/users/me', { ignoreUnauthorized: true });
}

export function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST', ignoreUnauthorized: true });
}

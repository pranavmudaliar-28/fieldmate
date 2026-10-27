import type { LoginResponse, User } from '@fieldmate/shared';
import { apiRequest } from '../../services/http';

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function getCurrentUser(signal?: AbortSignal): Promise<User> {
  return apiRequest<User>('/users/me', { ignoreUnauthorized: true, signal });
}

export function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST', ignoreUnauthorized: true });
}

/** Always succeeds for a well-formed email, whether or not an account exists. */
export function requestPasswordCode(email: string): Promise<void> {
  return apiRequest<void>('/auth/password/forgot', { method: 'POST', body: { email } });
}

/** Finishes an invitation or a reset; the response signs the user in. */
export function setPasswordWithCode(
  email: string,
  code: string,
  password: string,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/password/set', {
    method: 'POST',
    body: { email, code, password },
  });
}

export function updateMe(name: string): Promise<User> {
  return apiRequest<User>('/users/me', { method: 'PATCH', body: { name } });
}

/** Returns a fresh token: every other device is signed out. */
export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/users/me/password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

export function requestEmailChange(newEmail: string, currentPassword: string): Promise<void> {
  return apiRequest<void>('/users/me/email', {
    method: 'POST',
    body: { newEmail, currentPassword },
  });
}

export function confirmEmailChange(code: string): Promise<User> {
  return apiRequest<User>('/users/me/email/confirm', { method: 'POST', body: { code } });
}

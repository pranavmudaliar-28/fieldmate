import type { CreateUserInput, ManagedUser, UpdateUserInput } from '@fieldmate/shared';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import * as api from './api';
import type { UserListQuery } from './api';

export const userKeys = {
  all: ['admin', 'users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UserListQuery) => [...userKeys.lists(), filters] as const,
  detail: (userId: string) => [...userKeys.all, 'detail', userId] as const,
};

function applyUserUpdate(queryClient: QueryClient, user: ManagedUser) {
  queryClient.setQueryData(userKeys.detail(user.id), user);
  void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
  // A role or status change also affects who can be assigned work.
  void queryClient.invalidateQueries({ queryKey: ['users', 'workers'] });
}

export function useUserList(filters: Omit<UserListQuery, 'cursor'> = {}) {
  return useInfiniteQuery({
    queryKey: userKeys.list(filters),
    queryFn: ({ pageParam }) =>
      api.fetchUsers({ ...filters, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useUser(userId: string) {
  return useQuery({ queryKey: userKeys.detail(userId), queryFn: () => api.fetchUser(userId) });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => api.createUser(input),
    onSuccess: (user) => applyUserUpdate(queryClient, user),
  });
}

export function useUpdateUser(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserInput) => api.updateUser(userId, input),
    onSuccess: (user) => applyUserUpdate(queryClient, user),
  });
}

export function useSetUserPassword(userId: string) {
  return useMutation({ mutationFn: (password: string) => api.setUserPassword(userId, password) });
}

export function useRevokeUserSessions(userId: string) {
  return useMutation({ mutationFn: () => api.revokeUserSessions(userId) });
}

export function useDeleteUser(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteUser(userId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: userKeys.detail(userId) });
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

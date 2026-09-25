import type {
  Client,
  ClientDetail,
  MsUser,
  MsUserDetail,
  Service,
  Settings,
  Snapshot,
  VersionInfo,
} from '@renewals/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { keys } from './query';

export function useSnapshot() {
  return useQuery({ queryKey: keys.snapshot, queryFn: () => api<Snapshot>('/api/v1/snapshot') });
}

export function useClientDetail(id: number) {
  return useQuery({
    queryKey: keys.client(id),
    queryFn: () => api<ClientDetail>(`/api/v1/clients/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: () => api<Settings>('/api/v1/settings') });
}

export function useVersion() {
  return useQuery({
    queryKey: keys.version,
    queryFn: () => api<VersionInfo>('/api/version'),
    staleTime: 1000 * 60 * 60,
  });
}

export function useMsUsers() {
  return useQuery({ queryKey: keys.msUsers, queryFn: () => api<MsUser[]>('/api/v1/microsoft/users') });
}

export function useMsUser(graphId: string) {
  return useQuery({
    queryKey: keys.msUser(graphId),
    queryFn: () => api<MsUserDetail>(`/api/v1/microsoft/users/${encodeURIComponent(graphId)}`),
  });
}

/** Refreshes everything that may show the changed data. */
function useInvalidate() {
  const qc = useQueryClient();
  return (clientId?: number) => {
    void qc.invalidateQueries({ queryKey: keys.snapshot });
    if (clientId !== undefined) void qc.invalidateQueries({ queryKey: keys.client(clientId) });
  };
}

export function useCreateClient() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { name: string; phone?: string | null }) =>
      api<Client>('/api/v1/clients', { method: 'POST', body: input }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateClient(id: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { name?: string; phone?: string | null; note?: string | null }) =>
      api<Client>(`/api/v1/clients/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => invalidate(id),
  });
}

export function useArchiveClient(id: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api(`/api/v1/clients/${id}/archive`, { method: 'POST' }),
    onSuccess: () => invalidate(id),
  });
}

export type ServiceBody = Partial<Omit<Service, 'id' | 'renewal_date'>> & { renewal_date?: string };

export function useSaveService(serviceId?: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: ServiceBody) =>
      serviceId === undefined
        ? api<Service>('/api/v1/services', { method: 'POST', body })
        : api<Service>(`/api/v1/services/${serviceId}`, { method: 'PATCH', body }),
    onSuccess: (s) => invalidate(s.client_id),
  });
}

export function useArchiveService(serviceId: number, clientId: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api(`/api/v1/services/${serviceId}/archive`, { method: 'POST' }),
    onSuccess: () => invalidate(clientId),
  });
}

export function useMarkPaid(clientId: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (s: Pick<Service, 'id' | 'renewal_date'>) =>
      api<{ service: Service; already_paid: boolean }>(`/api/v1/services/${s.id}/mark-paid`, {
        method: 'POST',
        body: { expected_renewal_date: s.renewal_date.slice(0, 10) },
      }),
    onSuccess: () => invalidate(clientId),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => api<Settings>('/api/v1/settings', { method: 'PATCH', body: patch }),
    onSuccess: (s) => qc.setQueryData(keys.settings, s),
  });
}

export function useLinkMsUser(graphId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { client_id: number } | { new_client_name: string }) =>
      api<{ client_id: number }>(`/api/v1/microsoft/users/${encodeURIComponent(graphId)}/link`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.snapshot });
      void qc.invalidateQueries({ queryKey: keys.msUsers });
    },
  });
}

export function useMicrosoftConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: 'connect' | 'disconnect') =>
      api(`/api/v1/integrations/microsoft/${action}`, { method: 'POST' }),
    onSettled: () => void qc.invalidateQueries({ queryKey: keys.snapshot }),
  });
}

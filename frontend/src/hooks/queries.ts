import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useCompany(address: string) {
  return useQuery({
    queryKey: ['company', address],
    queryFn: () => api.getCompany(address),
    enabled: Boolean(address),
    retry: false,
  });
}

export function useCompanyContractors(companyAddress: string) {
  return useQuery({
    queryKey: ['contractors', companyAddress],
    queryFn: () => api.getCompanyContractors(companyAddress),
    enabled: Boolean(companyAddress),
    retry: false,
  });
}

export function usePayrollRun(runId: number | null) {
  return useQuery({
    queryKey: ['payroll-run', runId],
    queryFn: () => api.getPayrollRun(runId as number),
    enabled: runId !== null && runId >= 0,
    retry: false,
  });
}

export function useStream(streamId: number | null) {
  return useQuery({
    queryKey: ['stream', streamId],
    queryFn: () => api.getStream(streamId as number),
    enabled: streamId !== null && streamId >= 0,
    retry: false,
  });
}

export function useSenderStreams(sender: string) {
  return useQuery({
    queryKey: ['streams', sender],
    queryFn: async () => {
      const ids = await api.getSenderStreams(sender);
      return Promise.all(ids.map((id) => api.getStream(id)));
    },
    enabled: Boolean(sender),
    retry: false,
  });
}

export function useRecipientStreams(recipient: string) {
  return useQuery({
    queryKey: ['streams', recipient],
    queryFn: async () => {
      const ids = await api.getRecipientStreams(recipient);
      return Promise.all(ids.map((id) => api.getStream(id)));
    },
    enabled: Boolean(recipient),
    retry: false,
  });
}
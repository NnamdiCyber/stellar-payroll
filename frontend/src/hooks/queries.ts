import { useQuery } from '@tanstack/react-query';
import { api, ContractorRecord } from '../api/client';

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

async function resolveContractors(companyAddress: string): Promise<ContractorRecord[]> {
  const addressOrRecords = await api.getCompanyContractors(companyAddress);
  const records: ContractorRecord[] = [];
  for (const entry of addressOrRecords) {
    if (typeof entry === 'string') {
      records.push(await api.getContractor(companyAddress, entry));
    } else {
      records.push(entry);
    }
  }
  return records;
}

export function useContractorsDetailed(companyAddress: string) {
  return useQuery({
    queryKey: ['contractors-detailed', companyAddress],
    queryFn: () => resolveContractors(companyAddress),
    enabled: Boolean(companyAddress),
    retry: false,
  });
}

export function usePayrollNextRunId() {
  return useQuery({
    queryKey: ['payroll-next-run-id'],
    queryFn: api.getNextRunId,
    staleTime: 15_000,
  });
}

export function usePayrollRuns(companyFilter: string) {
  return useQuery({
    queryKey: ['payroll-runs', companyFilter],
    queryFn: async () => {
      const { nextRunId } = await api.getNextRunId();
      const ids = Array.from({ length: nextRunId }, (_, i) => i);
      const runs = await Promise.all(ids.map((runId) => api.getPayrollRun(runId)));
      return runs
        .filter((run) => !companyFilter || run.company === companyFilter)
        .sort((a, b) => Number(b.id) - Number(a.id));
    },
    staleTime: 15_000,
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

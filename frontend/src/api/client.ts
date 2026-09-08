const BASE = '/api/v1';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: boolean;
  message?: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(`Request failed with status ${res.status}`);
  }

  const envelope = body as ApiEnvelope<T>;
  if (!res.ok || !envelope.success) {
    throw new Error(envelope.message || `Request failed with status ${res.status}`);
  }
  return envelope.data;
}

export interface RegisteredCompany {
  transactionHash: string;
  companyAddress: string;
}

export interface RegisteredRun {
  runId: number;
  transactionHash: string;
}

export interface CreatedStream {
  streamId: number;
  transactionHash: string;
}

export interface AccountData {
  publicKey: string;
  secretKey: string;
}

export const api = {
  createTestAccount: () => request<AccountData>('/anchor/create-account', { method: 'POST' }),
  registerCompany: (body: {
    adminSecretKey: string;
    signers: string[];
    minSigners: number;
    tokenAddress: string;
  }) => request<RegisteredCompany>('/payroll/companies', { method: 'POST', body: JSON.stringify(body) }),
  addContractor: (body: {
    adminSecretKey: string;
    companyAddress: string;
    contractorAddress: string;
    name: string;
    email: string;
  }) => request<{ transactionHash: string }>('/payroll/contractors', { method: 'POST', body: JSON.stringify(body) }),
  createRun: (body: {
    adminSecretKey: string;
    companyAddress: string;
    periodStart: number;
    periodEnd: number;
  }) => request<RegisteredRun>('/payroll/runs', { method: 'POST', body: JSON.stringify(body) }),
  createStream: (body: {
    senderSecretKey: string;
    recipientAddress: string;
    tokenAddress: string;
    amountPerSecond: string;
    maxAmount: string;
    durationSeconds: number;
    memo: string;
  }) => request<CreatedStream>('/streams', { method: 'POST', body: JSON.stringify(body) }),
};
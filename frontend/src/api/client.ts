const BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: boolean;
  message?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
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

export interface BalanceData {
  publicKey: string;
  balance: string;
}

export interface CompanyRecord {
  admin: string;
  signers: string[];
  min_signers: number;
  token: string;
  active: boolean;
}

export interface ContractorRecord {
  wallet: string;
  name: string;
  email: string;
  active: boolean;
  total_paid: string;
}

export interface PayrollRunRecord {
  id: string;
  company: string;
  period_start: string;
  period_end: string;
  status: string;
  total_amount: string;
  payment_count: number;
  approvals: string[];
  created_at: string;
  executed_at: string;
}

export interface PaymentRecord {
  contractor: string;
  amount: string;
  currency: string;
  memo: string;
  paid: boolean;
  tx_hash: string;
}

export interface StreamRecord {
  id: number;
  sender: string;
  recipient: string;
  token: string;
  amountPerSecond: string;
  maxAmount: string;
  totalFunded: string;
  startTime: string;
  endTime: string;
  lastWithdrawTime: string;
  withdrawn: string;
  cancelled: boolean;
  memo: string;
  availableAmount?: string;
}

export interface EscrowBalanceData {
  balance: string;
}

export const api = {
  createTestAccount: () =>
    request<AccountData>('/anchor/create-account', { method: 'POST' }),
  getBalance: (publicKey: string) => request<BalanceData>(`/anchor/balance/${publicKey}`),
  registerCompany: (body: {
    adminSecretKey: string;
    signers: string[];
    minSigners: number;
    tokenAddress: string;
  }) =>
    request<RegisteredCompany>('/payroll/companies', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  addContractor: (body: {
    adminSecretKey: string;
    companyAddress: string;
    contractorAddress: string;
    name: string;
    email: string;
  }) =>
    request<{ transactionHash: string }>('/payroll/contractors', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  removeContractor: (
    companyAddress: string,
    contractorAddress: string,
    adminSecretKey: string,
  ) =>
    request<{ transactionHash: string }>(
      `/payroll/contractors/${companyAddress}/${contractorAddress}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminSecretKey}` },
      },
    ),
  createRun: (body: {
    adminSecretKey: string;
    companyAddress: string;
    periodStart: number;
    periodEnd: number;
  }) =>
    request<RegisteredRun>('/payroll/runs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  addPayment: (body: {
    adminSecretKey: string;
    companyAddress: string;
    runId: number;
    contractorAddress: string;
    amount: string;
    currency: string;
    memo?: string;
  }) =>
    request<{ transactionHash: string }>('/payroll/payments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  approveRun: (body: {
    companyAddress: string;
    runId: number;
    signerSecretKey: string;
  }) =>
    request<{ transactionHash: string }>('/payroll/runs/approve', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  executeRun: (runId: number, companyAddress: string, signerSecretKey: string) =>
    request<{ transactionHash: string }>(`/payroll/runs/${runId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ companyAddress, signerSecretKey }),
    }),
  createStream: (body: {
    senderSecretKey: string;
    recipientAddress: string;
    tokenAddress: string;
    amountPerSecond: string;
    maxAmount: string;
    durationSeconds: number;
    memo: string;
  }) =>
    request<CreatedStream>('/streams', { method: 'POST', body: JSON.stringify(body) }),
  withdrawFromStream: (
    streamId: number,
    body: {
      recipientSecretKey: string;
      amount: string;
    },
  ) =>
    request<{ transactionHash: string }>(`/streams/${streamId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  cancelStream: (streamId: number, senderSecretKey: string) =>
    request<{ transactionHash: string }>(`/streams/${streamId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ senderSecretKey }),
    }),
  getCompany: (address: string) =>
    request<CompanyRecord>(`/payroll/companies/${address}`),
  getCompanyContractors: (companyAddress: string) =>
    request<string[] | ContractorRecord[]>(
      `/payroll/companies/${companyAddress}/contractors`,
    ),
  getContractor: (companyAddress: string, contractorAddress: string) =>
    request<ContractorRecord>(
      `/payroll/companies/${companyAddress}/contractors/${contractorAddress}`,
    ),
  getCompanyBalance: (companyAddress: string, tokenAddress: string) =>
    request<EscrowBalanceData>(
      `/payroll/companies/${companyAddress}/balance/${tokenAddress}`,
    ),
  getPayrollRun: (runId: number) => request<PayrollRunRecord>(`/payroll/runs/${runId}`),
  getNextRunId: () => request<{ nextRunId: number }>('/payroll/runs/next'),
  getPayment: (runId: number, contractorAddress: string) =>
    request<PaymentRecord>(`/payroll/runs/${runId}/payments/${contractorAddress}`),
  getStream: (streamId: number) => request<StreamRecord>(`/streams/${streamId}`),
  getRecipientStreams: (recipient: string) =>
    request<number[]>(`/streams/recipient/${recipient}`),
  getSenderStreams: (sender: string) => request<number[]>(`/streams/sender/${sender}`),
};

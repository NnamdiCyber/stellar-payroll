import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../client';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
});

function mockOk(data: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data }),
  });
}

function mockError(status: number, message: string) {
  fetchMock.mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ success: false, message }),
  });
}

describe('api client', () => {
  it('createTestAccount sends POST /anchor/create-account', async () => {
    const accountData = { publicKey: 'GABC', secretKey: 'SABC' };
    mockOk(accountData);
    const result = await api.createTestAccount();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/anchor/create-account',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual(accountData);
  });

  it('registerCompany posts the expected body', async () => {
    const resp = { transactionHash: 'tx1', companyAddress: 'GCo' };
    mockOk(resp);
    const result = await api.registerCompany({
      adminSecretKey: 'S...',
      signers: ['GA'],
      minSigners: 1,
      tokenAddress: 'CT',
    });
    expect(result).toEqual(resp);
    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(opts.body).toBe(
      JSON.stringify({
        adminSecretKey: 'S...',
        signers: ['GA'],
        minSigners: 1,
        tokenAddress: 'CT',
      }),
    );
  });

  it('throws on non-ok response', async () => {
    mockError(400, 'bad request');
    await expect(api.createTestAccount()).rejects.toThrow('bad request');
  });

  it('removeContractor sends DELETE with bearer secret in header', async () => {
    mockOk({ transactionHash: 'tx1' });
    await api.removeContractor('GCo', 'GCt', 'SKey');
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/payroll/contractors/GCo/GCt');
    expect(opts.method).toBe('DELETE');
    expect(opts.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer SKey',
    });
  });

  it('executeRun posts company + signer key to run endpoint', async () => {
    mockOk({ transactionHash: 'tx1' });
    await api.executeRun(7, 'GCo', 'SSigner');
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/payroll/runs/7/execute');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(
      JSON.stringify({ companyAddress: 'GCo', signerSecretKey: 'SSigner' }),
    );
  });

  it('cancelStream posts sender secret to cancel endpoint', async () => {
    mockOk({ transactionHash: 'tx1' });
    await api.cancelStream(3, 'SSender');
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/streams/3/cancel');
    expect(opts.body).toBe(JSON.stringify({ senderSecretKey: 'SSender' }));
  });

  it('getCompany fetches a typed company record', async () => {
    const company = {
      admin: 'GA',
      signers: ['GA'],
      min_signers: 1,
      token: 'CT',
      active: true,
    };
    mockOk(company);
    await expect(api.getCompany('GA')).resolves.toEqual(company);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/payroll/companies/GA',
      expect.objectContaining({ headers: expect.anything() }),
    );
  });

  it('getNextRunId resolves the run id counter', async () => {
    mockOk({ nextRunId: 7 });
    await expect(api.getNextRunId()).resolves.toEqual({ nextRunId: 7 });
  });

  it('addPayment posts payment body to payroll endpoint', async () => {
    mockOk({ transactionHash: 'tx1' });
    await api.addPayment({
      adminSecretKey: 'SAdmin',
      companyAddress: 'GCo',
      runId: 2,
      contractorAddress: 'GCt',
      amount: '500000000',
      currency: 'CTok',
    });
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/payroll/payments');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(
      JSON.stringify({
        adminSecretKey: 'SAdmin',
        companyAddress: 'GCo',
        runId: 2,
        contractorAddress: 'GCt',
        amount: '500000000',
        currency: 'CTok',
      }),
    );
  });

  it('getStream resolves stream record with available amount', async () => {
    const stream = { id: 1, recipient: 'GR', availableAmount: '100' };
    mockOk(stream);
    await expect(api.getStream(1)).resolves.toEqual(stream);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/streams/1',
      expect.objectContaining({ headers: expect.anything() }),
    );
  });

  it('getRecipientStreams resolves stream id list', async () => {
    mockOk([1, 2, 3]);
    await expect(api.getRecipientStreams('GR')).resolves.toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/streams/recipient/GR',
      expect.objectContaining({ headers: expect.anything() }),
    );
  });
});

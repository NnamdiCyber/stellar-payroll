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
});

import { describe, it, expect } from 'vitest';
import { CompanyCreateSchema, ContractorAddSchema } from '../schemas';

describe('CompanyCreateSchema', () => {
  it('validates a correct payload', () => {
    const result = CompanyCreateSchema.parse({
      adminSecretKey: 'SC4uR3K...',
      signers: ['GA...', 'GB...'],
      minSigners: 2,
      tokenAddress: 'CA...',
    });
    expect(result.minSigners).toBe(2);
  });

  it('rejects missing fields', () => {
    expect(() =>
      CompanyCreateSchema.parse({ adminSecretKey: 'SC...' }),
    ).toThrow();
  });
});

describe('ContractorAddSchema', () => {
  it('validates with valid email', () => {
    const result = ContractorAddSchema.parse({
      companyAddress: 'GA...',
      contractorAddress: 'GB...',
      name: 'Jane Doe',
      email: 'jane@example.com',
    });
    expect(result.name).toBe('Jane Doe');
  });

  it('rejects invalid email', () => {
    expect(() =>
      ContractorAddSchema.parse({
        companyAddress: 'GA...',
        contractorAddress: 'GB...',
        name: 'Jane',
        email: 'not-an-email',
      }),
    ).toThrow();
  });
});

import { describe, it, expect } from 'vitest';
import {
  CompanyCreateSchema,
  ContractorAddSchema,
  PaymentAddSchema,
  StreamCreateSchema,
  PublicKeyParamsSchema,
} from '../schemas';

const SECRET = 'SIFYWEXPH4KUNIAS7MA3C54JIFQICBPZQYWNFZSMSPMLGXGNOOFKBGMJ';
const PUBLIC = 'GEWGPNSM2NO5HM2QDCDMJQOOWL5273VDKC7KYATUE3SFGLDD7JPOAB3D';
const PUBLIC2 = 'GWBY4VFOKLFJZOTBPUI47S4TILSRUDPYMIHDT6PYQJVPLEK5GGHTK32L';
const CONTRACT = 'C52L7HHP3HXUFE7SXVLAJK7ZQ4T5NZNEMAJLZ2D4SSXY5CMCJLSQICBF';

describe('CompanyCreateSchema', () => {
  it('validates a correct payload', () => {
    const result = CompanyCreateSchema.parse({
      adminSecretKey: SECRET,
      signers: [PUBLIC, PUBLIC2],
      minSigners: 2,
      tokenAddress: CONTRACT,
    });
    expect(result.minSigners).toBe(2);
  });

  it('rejects missing fields', () => {
    expect(() => CompanyCreateSchema.parse({ adminSecretKey: SECRET })).toThrow();
  });

  it('rejects malformed secret keys', () => {
    expect(() =>
      CompanyCreateSchema.parse({
        adminSecretKey: 'not-a-secret',
        signers: [PUBLIC],
        minSigners: 1,
        tokenAddress: CONTRACT,
      }),
    ).toThrow();
  });

  it('rejects minSigners greater than number of signers', () => {
    expect(() =>
      CompanyCreateSchema.parse({
        adminSecretKey: SECRET,
        signers: [PUBLIC],
        minSigners: 2,
        tokenAddress: CONTRACT,
      }),
    ).toThrow();
  });

  it('rejects unknown keys', () => {
    expect(() =>
      CompanyCreateSchema.parse({
        adminSecretKey: SECRET,
        signers: [PUBLIC],
        minSigners: 1,
        tokenAddress: CONTRACT,
        extra: true,
      }),
    ).toThrow();
  });
});

describe('ContractorAddSchema', () => {
  it('validates with valid email', () => {
    const result = ContractorAddSchema.parse({
      adminSecretKey: SECRET,
      companyAddress: PUBLIC,
      contractorAddress: PUBLIC2,
      name: 'Jane Doe',
      email: 'jane@example.com',
    });
    expect(result.name).toBe('Jane Doe');
  });

  it('rejects invalid email', () => {
    expect(() =>
      ContractorAddSchema.parse({
        adminSecretKey: SECRET,
        companyAddress: PUBLIC,
        contractorAddress: PUBLIC2,
        name: 'Jane',
        email: 'not-an-email',
      }),
    ).toThrow();
  });

  it('rejects oversized names', () => {
    expect(() =>
      ContractorAddSchema.parse({
        adminSecretKey: SECRET,
        companyAddress: PUBLIC,
        contractorAddress: PUBLIC2,
        name: 'x'.repeat(101),
        email: 'jane@example.com',
      }),
    ).toThrow();
  });
});

describe('PaymentAddSchema', () => {
  it('rejects non-numeric amounts', () => {
    expect(() =>
      PaymentAddSchema.parse({
        adminSecretKey: SECRET,
        companyAddress: PUBLIC,
        runId: 1,
        contractorAddress: PUBLIC2,
        amount: 'abc',
        currency: CONTRACT,
      }),
    ).toThrow();
  });

  it('rejects zero and negative amounts', () => {
    for (const amount of ['0', '-5']) {
      expect(() =>
        PaymentAddSchema.parse({
          adminSecretKey: SECRET,
          companyAddress: PUBLIC,
          runId: 1,
          contractorAddress: PUBLIC2,
          amount,
          currency: CONTRACT,
        }),
      ).toThrow();
    }
  });

  it('accepts valid amounts and defaults memo', () => {
    const result = PaymentAddSchema.parse({
      adminSecretKey: SECRET,
      companyAddress: PUBLIC,
      runId: 1,
      contractorAddress: PUBLIC2,
      amount: '250000',
      currency: CONTRACT,
    });
    expect(result.amount).toBe('250000');
    expect(result.memo).toBe('');
  });
});

describe('StreamCreateSchema', () => {
  it('rejects a non-alphabetic token address', () => {
    expect(() =>
      StreamCreateSchema.parse({
        senderSecretKey: SECRET,
        recipientAddress: PUBLIC,
        tokenAddress: 'not-a-contract',
        amountPerSecond: '100',
        maxAmount: '1000000',
        durationSeconds: 1000,
      }),
    ).toThrow();
  });
});

describe('PublicKeyParamsSchema', () => {
  it('rejects malformed public keys', () => {
    expect(() => PublicKeyParamsSchema.parse({ publicKey: 'Gtooshort' })).toThrow();
    expect(() => PublicKeyParamsSchema.parse({ publicKey: `${PUBLIC}extra` })).toThrow();
  });
});
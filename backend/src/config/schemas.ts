import { z } from 'zod';

const publicKey = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, 'Must be a valid Stellar public key (G...)');

const secretKey = z
  .string()
  .regex(/^S[A-Z0-9]{55}$/, 'Must be a valid Stellar secret key (S...)');

const contractAddress = z
  .string()
  .regex(/^C[A-Z0-9]{55}$/, 'Must be a valid Stellar contract address (C...)');

const amount = z
  .string()
  .regex(/^[1-9][0-9]*$/, 'Must be a positive integer amount');

export const CompanyCreateSchema = z
  .object({
    adminSecretKey: secretKey,
    signers: z.array(publicKey).min(1, 'At least one signer required'),
    minSigners: z.number().int().positive(),
    tokenAddress: contractAddress,
  })
  .strict()
  .refine((data) => data.minSigners <= data.signers.length, {
    message: 'minSigners cannot exceed the number of signers',
    path: ['minSigners'],
  });

export const ContractorAddSchema = z
  .object({
    adminSecretKey: secretKey,
    companyAddress: publicKey,
    contractorAddress: publicKey,
    name: z.string().min(1).max(100),
    email: z.string().email().max(254),
  })
  .strict();

export const ContractorRemoveParamsSchema = z.object({
  companyAddr: publicKey,
  contractorAddr: publicKey,
});

export const PayrollCreateSchema = z
  .object({
    adminSecretKey: secretKey,
    companyAddress: publicKey,
    periodStart: z.number().int().positive(),
    periodEnd: z.number().int().positive(),
  })
  .strict()
  .refine((data) => data.periodEnd > data.periodStart, {
    message: 'periodEnd must be after periodStart',
    path: ['periodEnd'],
  });

export const PaymentAddSchema = z
  .object({
    adminSecretKey: secretKey,
    companyAddress: publicKey,
    runId: z.number().int().min(0),
    contractorAddress: publicKey,
    amount,
    currency: contractAddress,
    memo: z.string().max(256).optional().default(''),
  })
  .strict();

export const PayrollApproveSchema = z
  .object({
    companyAddress: publicKey,
    runId: z.number().int().min(0),
    signerSecretKey: secretKey,
  })
  .strict();

export const PayrollExecuteSchema = z
  .object({
    companyAddress: publicKey,
    runId: z.number().int().min(0),
    signerSecretKey: secretKey,
  })
  .strict();

export const PayrollRunIdParamsSchema = z.object({
  runId: z.coerce.number().int().min(0),
});

export const StreamCreateSchema = z
  .object({
    senderSecretKey: secretKey,
    recipientAddress: publicKey,
    tokenAddress: contractAddress,
    amountPerSecond: amount,
    maxAmount: amount,
    durationSeconds: z.number().int().positive(),
    memo: z.string().max(256).optional().default(''),
  })
  .strict();

export const StreamWithdrawSchema = z
  .object({
    streamId: z.number().int().min(0),
    recipientSecretKey: secretKey,
    amount,
  })
  .strict();

export const StreamCancelSchema = z
  .object({
    streamId: z.number().int().min(0),
    senderSecretKey: secretKey,
  })
  .strict();

export const StreamIdParamsSchema = z.object({
  streamId: z.coerce.number().int().min(0),
});

export const AnchorCreateTrustlineSchema = z
  .object({
    assetCode: z.string().min(1).max(12).refine((s) => /^[A-Z0-9]+$/.test(s), {
      message: 'Asset code must be alphanumeric',
    }),
    issuerPublicKey: publicKey,
    secretKey,
  })
  .strict();

export const PublicKeyParamsSchema = z.object({
  publicKey,
});

export const AddressParamsSchema = z.object({
  address: publicKey,
});

export const ContractorLookupParamsSchema = z.object({
  companyAddr: publicKey,
  contractorAddr: publicKey,
});

export const PaymentLookupParamsSchema = z.object({
  runId: z.coerce.number().int().min(0),
  contractorAddr: publicKey,
});

export const EscrowBalanceParamsSchema = z.object({
  companyAddr: publicKey,
  tokenAddr: contractAddress,
});

export const RecipientParamsSchema = z.object({
  recipient: publicKey,
});

export const SenderParamsSchema = z.object({
  sender: publicKey,
});

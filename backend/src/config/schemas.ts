import { z } from 'zod';

export const CompanyCreateSchema = z.object({
  adminSecretKey: z.string().min(1, 'Admin secret key is required'),
  signers: z.array(z.string()).min(1, 'At least one signer required'),
  minSigners: z.number().int().positive(),
  tokenAddress: z.string().min(1),
});

export const ContractorAddSchema = z.object({
  adminSecretKey: z.string().min(1, 'Admin secret key is required'),
  companyAddress: z.string().min(1),
  contractorAddress: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
});

export const PayrollCreateSchema = z.object({
  adminSecretKey: z.string().min(1, 'Admin secret key is required'),
  companyAddress: z.string().min(1),
  periodStart: z.number().int().positive(),
  periodEnd: z.number().int().positive(),
});

export const PaymentAddSchema = z.object({
  adminSecretKey: z.string().min(1, 'Admin secret key is required'),
  companyAddress: z.string().min(1),
  runId: z.number().int().min(0),
  contractorAddress: z.string().min(1),
  amount: z.string().min(1),
  currency: z.string().min(1),
  memo: z.string().optional().default(''),
});

export const PayrollApproveSchema = z.object({
  companyAddress: z.string().min(1),
  runId: z.number().int().min(0),
  signerSecretKey: z.string().min(1),
});

export const StreamCreateSchema = z.object({
  senderSecretKey: z.string().min(1),
  recipientAddress: z.string().min(1),
  tokenAddress: z.string().min(1),
  amountPerSecond: z.string().min(1),
  maxAmount: z.string().min(1),
  durationSeconds: z.number().int().positive(),
  memo: z.string().optional().default(''),
});

export const StreamWithdrawSchema = z.object({
  streamId: z.number().int().min(0),
  recipientSecretKey: z.string().min(1),
  amount: z.string().min(1),
});

export const StreamCancelSchema = z.object({
  streamId: z.number().int().min(0),
  senderSecretKey: z.string().min(1),
});

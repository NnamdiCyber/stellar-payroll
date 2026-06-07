import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.string().default('3000'),
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet', 'local']).default('testnet'),
  STELLAR_HORIZON_URL: z.string(),
  STELLAR_RPC_URL: z.string(),
  PAYROLL_CONTRACT_ID: z.string().optional(),
  STREAM_CONTRACT_ID: z.string().optional(),
  DATABASE_URL: z.string(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten());
    process.exit(1);
  }
  return parsed.data;
}

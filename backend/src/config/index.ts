import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet', 'local']).default('testnet'),
  STELLAR_HORIZON_URL: z.string().url(),
  STELLAR_RPC_URL: z.string().url(),
  PAYROLL_CONTRACT_ID: z.string().regex(/^C[A-Z0-9]{55}$/).optional(),
  STREAM_CONTRACT_ID: z.string().regex(/^C[A-Z0-9]{55}$/).optional(),
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

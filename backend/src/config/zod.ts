import { ZodError } from 'zod';

/** Format any thrown error into a single user-facing message. */
export function toErrorMessage(err: unknown): string {
  if (err instanceof ZodError) {
    return err.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
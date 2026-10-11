/**
 * Safe shape for logging a caught error. Logging the raw object is unsafe
 * here: the Circle SDK uses axios, whose errors carry the full request
 * (`config.headers.Authorization` with CIRCLE_API_KEY, and the encrypted
 * entity secret in the body). Secrets must never reach logs, so only the
 * fields useful for debugging are kept.
 */
export interface LoggableError {
  name: string;
  message: string;
  code?: string | number;
  stack?: string;
}

export function describeError(error: unknown): LoggableError {
  if (!(error instanceof Error)) {
    return { name: "NonError", message: String(error) };
  }
  const code = (error as { code?: unknown }).code;
  return {
    name: error.name,
    message: error.message,
    ...(typeof code === "string" || typeof code === "number" ? { code } : {}),
    stack: error.stack,
  };
}

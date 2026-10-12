import { describeError } from "@/lib/log-error";
import { ZodError } from "zod";
import { ExecutionError } from "@/lib/payments/execute";

export const GENERIC_ACTION_ERROR = "Something went wrong. Please try again.";
export const INVALID_INPUT_ERROR = "Invalid request.";

/**
 * Turns an error caught in a server action into a message safe to show the
 * user, and logs the full error server-side. ExecutionError messages are
 * written for people (they explain why a payment did not move), so they pass
 * through. Anything else is unexpected — a storage outage, a bug — and its
 * raw message may carry internal detail, so the browser gets a plain
 * fallback while the details go to the server log instead of vanishing.
 */
export function toActionErrorMessage(error: unknown, context: string): string {
  if (error instanceof ExecutionError) {
    console.warn(`${context}: ${error.code}: ${error.message}`);
    return error.message;
  }
  if (error instanceof ZodError) {
    return INVALID_INPUT_ERROR;
  }
  console.error(`${context} failed:`, describeError(error));
  return GENERIC_ACTION_ERROR;
}

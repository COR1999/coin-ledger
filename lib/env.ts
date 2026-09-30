import "server-only";

import { parseEnv } from "./env.schema";

/**
 * Validated, server-only environment. Importing this from client code is a
 * build error (via `server-only`), keeping secrets off the client. Parsed once
 * at module load so misconfiguration fails fast at startup.
 */
export const env = parseEnv(process.env);

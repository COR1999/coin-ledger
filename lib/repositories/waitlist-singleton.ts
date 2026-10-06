/**
 * Server-only entry point for the waitlist store — same pattern and same
 * reason as lib/repositories/singleton.ts. Application code (app/actions/
 * waitlist.ts, app/admin/waitlist/page.tsx) imports from here, not from
 * waitlist.ts directly; tests import waitlist.ts directly.
 */
import "server-only";

import { getKvClientIfConfigured } from "@/lib/repositories/kv-client";
import { setWaitlistKvClientProvider } from "@/lib/repositories/waitlist";

setWaitlistKvClientProvider(getKvClientIfConfigured);

export * from "@/lib/repositories/waitlist";

import Link from "next/link";

import { returnToDemoAction } from "@/app/actions/onboarding";
import { RoleSwitcher } from "@/components/app/role-switcher";
import { Button } from "@/components/ui/button";
import type { Actor } from "@/lib/domain/types";

/** Top bar: business identity, primary nav, and the demo role switcher. */
export function AppHeader({
  businessName,
  actors,
  currentActor,
  active,
  isDemo = true,
}: {
  businessName: string;
  actors: Actor[];
  currentActor: Actor;
  active: "dashboard" | "chat" | "approvals" | "transactions" | "settings";
  /** False when viewing a visitor's own onboarded workspace (Phase 8). */
  isDemo?: boolean;
}) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="var(--primary-foreground)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12l5 5L20 6" />
              </svg>
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Financial Operator
              </p>
              <p className="text-lg font-semibold leading-tight">
                {businessName}
              </p>
            </div>
          </div>
          <nav
            aria-label="Primary"
            className="flex flex-wrap items-center gap-1"
          >
            <NavLink href="/" current={active === "dashboard"}>
              Dashboard
            </NavLink>
            <NavLink href="/chat" current={active === "chat"}>
              Chat
            </NavLink>
            <NavLink href="/approvals" current={active === "approvals"}>
              Approvals
            </NavLink>
            <NavLink href="/transactions" current={active === "transactions"}>
              Transactions
            </NavLink>
            <NavLink href="/settings" current={active === "settings"}>
              Policies
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isDemo ? (
            <Link
              href="/onboarding"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Try with your business
            </Link>
          ) : (
            <form
              action={returnToDemoAction}
              className="flex items-center gap-2"
            >
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                Your workspace
              </span>
              <Button type="submit" variant="ghost" size="sm">
                Back to demo
              </Button>
            </form>
          )}
          <RoleSwitcher actors={actors} currentActorId={currentActor.id} />
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={
        current
          ? "rounded-md bg-secondary px-3 py-1.5 text-sm font-medium"
          : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }
    >
      {children}
    </Link>
  );
}

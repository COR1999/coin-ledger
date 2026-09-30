import Link from "next/link";

import { RoleSwitcher } from "@/components/app/role-switcher";
import type { Actor } from "@/lib/domain/types";

/** Top bar: business identity, primary nav, and the demo role switcher. */
export function AppHeader({
  businessName,
  actors,
  currentActor,
  active,
}: {
  businessName: string;
  actors: Actor[];
  currentActor: Actor;
  active: "dashboard" | "settings";
}) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Financial Operator
            </p>
            <p className="text-lg font-semibold leading-tight">
              {businessName}
            </p>
          </div>
          <nav aria-label="Primary" className="flex items-center gap-1">
            <NavLink href="/" current={active === "dashboard"}>
              Dashboard
            </NavLink>
            <NavLink href="/settings" current={active === "settings"}>
              Policies
            </NavLink>
          </nav>
        </div>
        <RoleSwitcher actors={actors} currentActorId={currentActor.id} />
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

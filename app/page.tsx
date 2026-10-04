import {
  Brain,
  ExternalLink,
  Link2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { returnToDemoAction } from "@/app/actions/onboarding";
import { DemoCtaButton } from "@/components/marketing/demo-cta-button";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { arcExplorerTxUrl } from "@/lib/config";
import { DEMO_WORKSPACE_ID } from "@/lib/repositories/singleton";
import { getCurrentWorkspaceId } from "@/lib/workspace";

// A real settled Arc testnet payment (Phase 6 demo story 2, see BUILD_LOG.md
// "Testnet transactions") — linked directly so a visitor can check the
// "provable, not just logged" claim themselves instead of taking it on faith.
const SAMPLE_TX_HASH =
  "0x56374933cd5e3a18b16d8a48e2e4419a0c4ec27fb307d1b12cdae80242965f6b";

const HOW_IT_WORKS = [
  {
    icon: MessageSquare,
    title: "Ask",
    body: '"Pay ABC Coffee €2,400 for this month\'s beans."',
  },
  {
    icon: Brain,
    title: "Propose",
    body: "The agent drafts the payment and explains its reasoning. It cannot send it.",
  },
  {
    icon: UserCheck,
    title: "Decide",
    body: "Your policies and your approval decide — not the AI, every time.",
  },
  {
    icon: Link2,
    title: "Settle",
    body: "Executes on Arc in under a second, with a transaction hash anyone can check.",
  },
] as const;

/**
 * Public marketing landing page. The product itself lives at /app (the
 * dashboard) — this route exists so a cold visitor at the root domain gets a
 * pitch and a choice, not straight into someone else's business data.
 */
export default async function LandingPage() {
  // A visitor who already completed onboarding (Phase 8) and revisits "/"
  // shouldn't be funneled toward "Try the demo" — that overwrites their
  // workspace cookie back to the demo. Give them a direct way back instead.
  const workspaceId = await getCurrentWorkspaceId();
  const hasOwnWorkspace = workspaceId !== DEMO_WORKSPACE_ID;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-4 sm:px-6">
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
          <p className="font-serif text-sm font-semibold">Coin Ledger</p>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-5xl">
            An AI bookkeeper that proposes payments.
            <br className="hidden sm:block" /> Rules and people decide.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            Ask it to pay a supplier. It proposes the payment; your policies and
            your approval decide whether it happens. Every executed payment
            settles on Arc testnet and carries a transaction hash anyone can
            independently verify — not just an entry in a database you&apos;re
            asked to trust.
          </p>
          {hasOwnWorkspace ? (
            <>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/app" className={buttonVariants({ size: "lg" })}>
                  Continue to your workspace
                </Link>
                <form action={returnToDemoAction}>
                  <DemoCtaButton />
                </form>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                You already set up a business here — pick up where you left off,
                or switch to the canned demo.
              </p>
            </>
          ) : (
            <>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <form action={returnToDemoAction}>
                  <DemoCtaButton />
                </form>
                <Link
                  href="/onboarding"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  Try with your business
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                No signup, no wallet, no real money — the demo and your own
                workspace both run on testnet, free to explore.
              </p>
            </>
          )}
        </section>

        {/* Product preview — a real screenshot, not a mockup, so a cold
            visitor sees the actual dashboard before trying it. Hidden below
            sm: at 375px the wide screenshot shrinks to illegible text, so it
            costs scroll weight for zero value — the "How it works" strip
            below already carries the same point in text on mobile. */}
        <section className="mx-auto hidden max-w-5xl px-4 pb-16 sm:block sm:px-6">
          <div className="overflow-hidden rounded-lg border shadow-sm">
            <Image
              src="/dashboard-preview.png"
              alt="Coin Ledger dashboard showing upcoming obligations and recent transactions, each with on-chain verification"
              width={2208}
              height={1044}
              className="h-auto w-full"
              priority
            />
          </div>
        </section>

        {/* How it works */}
        <section className="border-t py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="font-serif text-center text-xl font-semibold">
              How a payment actually happens
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-4">
              {HOW_IT_WORKS.map(({ icon: Icon, title, body }, i) => (
                <div key={title} className="text-center">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full border-2 border-accent text-accent">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {i + 1}. {title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Value props */}
        <section className="border-t bg-muted/30 py-16">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:grid-cols-3 sm:px-6">
            <Card className="border-t-2 border-t-accent">
              <CardHeader>
                <Zap className="mb-2 size-5 text-accent" aria-hidden />
                <CardTitle className="text-base text-foreground">
                  Settles in under a second
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                No 1–3 day bank transfer, no cutoff times, no waiting on a
                weekend. A supplier waiting on payment isn&apos;t waiting on a
                bank&apos;s clock.
              </CardContent>
            </Card>
            <Card className="border-t-2 border-t-accent">
              <CardHeader>
                <ShieldCheck className="mb-2 size-5 text-accent" aria-hidden />
                <CardTitle className="text-base text-foreground">
                  Nothing moves without a human
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                The agent can propose a payment and explain its reasoning. It
                can never sign, approve, or send money — your policies and your
                approval decide every time.
              </CardContent>
            </Card>
            <Card className="border-t-2 border-t-accent">
              <CardHeader>
                <Sparkles className="mb-2 size-5 text-accent" aria-hidden />
                <CardTitle className="text-base text-foreground">
                  Provable, not just logged
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Every executed payment carries a real transaction hash,
                checkable on a public explorer — independent proof it happened,
                for the exact amount, with nothing to take on faith.
                <a
                  href={arcExplorerTxUrl(SAMPLE_TX_HASH)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1 font-medium text-primary underline underline-offset-2"
                >
                  See a real settled payment{" "}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Waitlist */}
        <section id="waitlist" className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <div className="mb-6 text-center">
            <h2 className="font-serif text-xl font-semibold">
              Not ready to try it yet?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Leave your details and we&apos;ll reach out when it&apos;s ready
              for real use.
            </p>
          </div>
          <Card>
            <CardContent className="pt-5">
              <WaitlistForm />
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <p>
            Testnet demo — no real funds move. Built for the Tameion hackathon
            (Canteen × Circle).
          </p>
          <a
            href="https://github.com/COR1999/coin-ledger"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-medium text-foreground underline underline-offset-2"
          >
            View source on GitHub{" "}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </footer>
    </div>
  );
}

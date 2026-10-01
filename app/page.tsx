import { ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";
import Link from "next/link";

import { returnToDemoAction } from "@/app/actions/onboarding";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

/**
 * Public marketing landing page. The product itself lives at /app (the
 * dashboard) — this route exists so a cold visitor at the root domain gets a
 * pitch and a choice, not straight into someone else's business data.
 */
export default function LandingPage() {
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
          <p className="text-sm font-semibold">Financial Operator</p>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
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
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <form action={returnToDemoAction}>
              <Button type="submit" size="lg">
                Try the demo <ArrowRight className="size-4" />
              </Button>
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
        </section>

        {/* Value props */}
        <section className="border-t bg-muted/30 py-16">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:grid-cols-3 sm:px-6">
            <Card>
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
            <Card>
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
            <Card>
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
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Waitlist */}
        <section id="waitlist" className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold">Not ready to try it yet?</h2>
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
    </div>
  );
}

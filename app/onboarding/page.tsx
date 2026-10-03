import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default function OnboardingPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h1 className="font-serif text-xl font-semibold">
            Try it with your business
          </h1>
          <p className="text-sm text-muted-foreground">
            Your own business, suppliers and the same propose → approve →
            execute flow — settled on Arc testnet, same as the demo. Nothing you
            enter touches Mario&apos;s Coffee&apos;s data, and no wallet or real
            money is required.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>A few details to get started</CardTitle>
          </CardHeader>
          <CardContent>
            <OnboardingForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

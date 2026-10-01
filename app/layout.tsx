import type { CSSProperties } from "react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { brandThemeCssVars, getBrandTheme } from "@/lib/branding/theme";
import {
  DEMO_WORKSPACE_ID,
  getRepositories,
} from "@/lib/repositories/singleton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Small Business Financial Operator",
  description:
    "AI proposes, rules authorize, humans approve, infrastructure executes.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Theme is deliberately resolved from the demo business, not the current
  // visitor's workspace (Phase 8 onboarding). Every onboarded workspace
  // already renders in the same fallback theme today (THEMES_BY_BUSINESS_ID
  // only registers Mario's Coffee — see lib/branding/theme.ts), so this
  // changes nothing visible yet, but it decouples the public landing page
  // (Phase 9, lives at this same root layout) from a visitor's prior
  // workspace: without this, a visitor who onboarded their own business
  // and later revisits "/" would see the generic marketing page rendered in
  // whatever business-specific theme their workspace resolves to once a
  // second theme is ever registered. Real per-visitor theming, if wanted
  // again, belongs in a route-group layout scoped to the app shell, not here.
  const business = await getRepositories(DEMO_WORKSPACE_ID).business.get();
  const theme = getBrandTheme(business.id);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={brandThemeCssVars(theme) as CSSProperties}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

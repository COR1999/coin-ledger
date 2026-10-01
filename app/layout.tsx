import type { CSSProperties } from "react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { brandThemeCssVars, getBrandTheme } from "@/lib/branding/theme";
import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentWorkspaceId } from "@/lib/workspace";
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
  const business = await getRepositories(
    await getCurrentWorkspaceId(),
  ).business.get();
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

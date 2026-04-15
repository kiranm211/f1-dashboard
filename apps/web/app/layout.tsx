import type { Metadata } from "next";

import { SiteHeader } from "../components/SiteHeader";

import "./globals.css";

export const metadata: Metadata = {
  title: "F1 Live Control",
  description: "Local DB-backed F1 strategy dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
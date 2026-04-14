import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "F1 Live Control",
  description: "Local DB-backed F1 strategy dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
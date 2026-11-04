import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaaSScout AI™ | NOFA AI Factory",
  description: "Lean NOFA pilot for evidence-based B2B prospecting.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

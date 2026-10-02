import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const interTight = localFont({
  src: "../assets/fonts/inter-tight-variable.ttf",
  variable: "--font-inter-tight",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "aetos — Pushpendra Singh", template: "%s — Pushpendra Singh" },
  description: "I’m aetos, a systems engineer driven mostly by curiosity and an unreasonable attention to detail.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={interTight.variable}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <div className="page-shell">
          <SiteHeader />
          {children}
        </div>
      </body>
    </html>
  );
}

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
  title: { default: "Pushpendra Singh — Work", template: "%s — Pushpendra Singh" },
  description: "Systems, tools, and the interfaces around them. Selected work and open-source contributions by Pushpendra Singh, also known as aetos.",
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

import type { Metadata } from "next";
import localFont from "next/font/local";
import { SocialsDock } from "@/components/socials-dock";
import "./globals.css";

const interTight = localFont({
  src: "../assets/fonts/inter-tight-variable.ttf",
  variable: "--font-inter-tight",
  weight: "100 900",
  display: "swap",
});

const instrumentSerif = localFont({
  src: [
    { path: "../assets/fonts/InstrumentSerif-Regular.ttf", weight: "400", style: "normal" },
    { path: "../assets/fonts/InstrumentSerif-Italic.ttf", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
});

const geistMono = localFont({
  src: "../assets/fonts/GeistMono-Variable.ttf",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

const siteName = "aetos";
const siteTitle = "aetos — Pushpendra Singh";
const siteDescription = "I’m aetos, a systems engineer driven mostly by curiosity and an unreasonable attention to detail.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://aetosdios.xyz"),
  title: { default: siteTitle, template: "%s — Pushpendra Singh" },
  description: siteDescription,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName,
    title: siteTitle,
    description: siteDescription,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${interTight.variable} ${instrumentSerif.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <div className="page-shell">
          {children}
        </div>
        <SocialsDock />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SocialsDock } from "@/components/socials-dock";
import { SoundEffects } from "@/components/sound-effects";
import { CONTACT } from "@/content/contact";
import { identity } from "@/content/portfolio";
import "./globals.css";

const interTight = localFont({
  src: "../assets/fonts/inter-tight-variable.woff2",
  variable: "--font-inter-tight",
  weight: "100 900",
  display: "swap",
});

const instrumentSerif = localFont({
  src: [
    { path: "../assets/fonts/InstrumentSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
});

const geistMono = localFont({
  src: "../assets/fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

const siteName = "aetos";
const siteTitle = "aetos — Pushpendra Singh";
const siteDescription = "I’m aetos, a systems engineer driven mostly by curiosity and an unreasonable attention to detail.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aetosdios.xyz";

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: "%s — Pushpendra Singh" },
  description: siteDescription,
  applicationName: siteName,
  authors: [{ name: identity.name, url: siteUrl }],
  creator: identity.name,
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
    creator: "@aetosdios_",
    site: "@aetosdios_",
    title: siteTitle,
    description: siteDescription,
  },
};

const structuredData = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "Person",
    name: identity.name,
    alternateName: siteName,
    url: siteUrl,
    image: new URL(identity.avatar, siteUrl).toString(),
    jobTitle: "Systems engineer",
    sameAs: [CONTACT.github, CONTACT.x, CONTACT.linkedin],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
    description: siteDescription,
  },
]).replace(/</g, "\\u003c");

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${interTight.variable} ${instrumentSerif.variable} ${geistMono.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
        <a className="skip-link" href="#main">Skip to content</a>
        <div className="page-shell">
          {children}
        </div>
        <SocialsDock />
        <SoundEffects />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Display face: the team's custom "Tiltortion" font (single Regular weight,
 * static CFF). Used for the brand, hero title, headings, KPI numerals and
 * the pill nav via the `font-display` utility.
 */
const display = localFont({
  src: "./fonts/Tiltortion.otf",
  weight: "400",
  variable: "--font-display-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GharKart PricePulse — Live Competitor Intelligence Engine",
  description:
    "Dynamic pricing dashboard for Indian household essentials: tracks live competitor prices (Zomora, Swiggo, InstaBasket, AmazNow) with TinyFish (TinySearch + TinyFetch) and reprices GharKart with an ML engine. Built for Kritical Hacks 2026.",
  keywords: ["TinyFish", "dynamic pricing", "competitor intelligence", "AI agents", "quick commerce", "household products", "India", "hackathon"],
  authors: [{ name: "PricePulse Team" }],
  openGraph: {
    title: "GharKart PricePulse — Live Competitor Intelligence Engine",
    description:
      "TinyFish-powered dynamic pricing for Indian quick-commerce with ML forecasting and anomaly detection",
    siteName: "PricePulse",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable}`}
    >
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}

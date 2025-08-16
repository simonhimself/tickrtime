import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "TickrTime - Never miss earnings again",
  description: "A modern earnings tracking dashboard for technology stocks. Track earnings dates, estimates, actual results, and surprises for 2,246+ tech companies.",
  keywords: ["earnings", "stocks", "tech", "finance", "dashboard", "nasdaq", "nyse"],
  authors: [{ name: "TickrTime" }],
  creator: "TickrTime",
  openGraph: {
    title: "TickrTime - Never miss earnings again",
    description: "Track earnings for 2,246+ tech companies with real-time data",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TickrTime - Never miss earnings again",
    description: "Track earnings for 2,246+ tech companies with real-time data",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add verification codes when ready for production
    // google: "",
    // yandex: "",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <Sonner />
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RectaSol - Advanced Software, AI Automation & Digital Systems",
    template: "%s | RectaSol",
  },
  description:
    "RectaSol builds websites, apps, AI automation, SaaS platforms, CRM systems, dashboards, cloud workflows, and digital growth systems for ambitious businesses.",
  keywords: [
    "RectaSol",
    "Asad software company",
    "Next.js development",
    "AI automation",
    "web application development",
    "mobile app development",
    "CRM development",
    "SaaS development",
  ],
  openGraph: {
    title: "RectaSol - Systems with Sense",
    description: "Advanced software, AI automation, cloud, design, and digital growth systems.",
    url: SITE_URL,
    siteName: "RectaSol",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
      </body>
    </html>
  );
}

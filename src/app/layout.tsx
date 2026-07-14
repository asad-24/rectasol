import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Preloader } from "@/components/motion/Preloader";
import { SmoothScrollProvider } from "@/components/motion/SmoothScrollProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rectasol.com"),
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
    url: "https://rectasol.com",
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
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        <SmoothScrollProvider>
          <Preloader />
          <Header />
          <main>{children}</main>
          <Footer />
          <Toaster richColors position="top-right" />
        </SmoothScrollProvider>
      </body>
    </html>
  );
}

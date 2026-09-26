import { Toaster } from "sonner";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Preloader } from "@/components/motion/Preloader";
import { SmoothScrollProvider } from "@/components/motion/SmoothScrollProvider";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <SmoothScrollProvider>
    <Preloader /><Header /><main>{children}</main><Footer />
    <Toaster richColors position="top-right" />
  </SmoothScrollProvider>;
}

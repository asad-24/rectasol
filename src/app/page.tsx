import { CaseStudiesPreview } from "@/components/sections/CaseStudiesPreview";
import { FaqSection } from "@/components/sections/FaqSection";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { FeaturedProjects } from "@/components/sections/FeaturedProjects";
import { HeroSection } from "@/components/sections/HeroSection";
import { HomeContactSection } from "@/components/sections/HomeContactSection";
import { MarqueeSection } from "@/components/sections/MarqueeSection";
import { AboutFeatureSection } from "@/components/sections/AboutFeatureSection";
import { PartnersStrip } from "@/components/sections/PartnersStrip";
import { PositioningBanner } from "@/components/sections/PositioningBanner";
import { ProcessSection } from "@/components/sections/ProcessSection";
import { ServicesPreview } from "@/components/sections/ServicesPreview";
import { SocialMediaSection } from "@/components/sections/SocialMediaSection";
import { TechStackBuilder } from "@/components/sections/TechStackBuilder";
import { TestimonialsSection } from "@/components/sections/TestimonialsSection";

export default function Home() {
  return (
    <>
      <HeroSection />
      <PartnersStrip />
      <PositioningBanner />
      <ServicesPreview />
      <AboutFeatureSection />
      <ProcessSection />
      <TechStackBuilder />
      <FeaturedProjects />
      <CaseStudiesPreview />
      <TestimonialsSection />
      <HomeContactSection />
      <SocialMediaSection />
      <FaqSection />
      <MarqueeSection />
      <FinalCTA />
    </>
  );
}
